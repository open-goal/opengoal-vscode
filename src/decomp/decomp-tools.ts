import { exec, execFile } from "child_process";
import { existsSync, promises as fs } from "fs";
import * as vscode from "vscode";
import { determineGameFromPath, GameName } from "../utils/file-utils";
import { open_in_pdf } from "./man-page";
import * as util from "util";
import {
  getConfig,
  updateAutoDecompilation,
  updateDecompilerPath,
  updateFormatterPath,
} from "../config/config";
import * as path from "path";
import {
  getExtensionContext,
  getProjectRoot,
  updateStatusBar,
} from "../context";
import {
  getFileNamesFromUris,
  getUrisFromTabs,
  truncateFileNameEndings,
} from "../utils/workspace";
import { activateDecompTypeSearcher } from "./type-searcher/type-searcher";
import { updateTypeCastSuggestions } from "./type-caster";
import { glob } from "fast-glob";
import {
  getFuncBodyFromPosition,
  getFuncNameFromPosition,
} from "../languages/ir2/ir2-utils";
import { copyVarCastsFromOneGameToAnother } from "./utils";

const execFileAsync = util.promisify(execFile);
const execAsync = util.promisify(exec);

let channel: vscode.OutputChannel;
let fsWatcher: vscode.FileSystemWatcher | undefined;

enum DecompStatus {
  Idle,
  Decompiling,
  Errored,
  Formatting,
  FormattingError,
}

function updateStatus(status: DecompStatus, metadata?: any) {
  let subText = "";
  switch (status) {
    case DecompStatus.Errored:
      updateStatusBar(false, true, "Decomp Failed");
      break;
    case DecompStatus.FormattingError:
      updateStatusBar(false, true, "Formatting Failed");
      break;
    case DecompStatus.Decompiling:
    case DecompStatus.Formatting:
      if (metadata.objectNames.length > 0) {
        if (metadata.objectNames.length <= 5) {
          subText = metadata.objectNames.join(", ");
        } else {
          subText = `${metadata.objectNames.slice(0, 5).join(", ")}, and ${
            metadata.objectNames.length - 5
          } more`;
        }
      }
      updateStatusBar(
        true,
        false,
        `${status == DecompStatus.Decompiling ? "Decompiling" : "Formatting"} - ${subText} - [ ${metadata.decompConfig} ]`,
      );
      break;
    default:
      updateStatusBar(false, false);
      break;
  }
}

function defaultDecompPath() {
  const platform = process.platform;
  if (platform == "win32") {
    return "out/build/Release/bin/decompiler.exe";
  } else {
    return "build/decompiler/decompiler";
  }
}

function defaultFormatterPath() {
  const platform = process.platform;
  if (platform == "win32") {
    return "out/build/Release/bin/formatter.exe";
  } else {
    return "build/tools/formatter";
  }
}

function getDecompilerConfig(gameName: GameName): string | undefined {
  let decompConfigPath = undefined;
  if (gameName == GameName.Jak1) {
    decompConfigPath = vscode.Uri.joinPath(
      getProjectRoot(),
      `decompiler/config/jak1/jak1_config.jsonc`,
    ).fsPath;
  } else if (gameName == GameName.Jak2) {
    decompConfigPath = vscode.Uri.joinPath(
      getProjectRoot(),
      `decompiler/config/jak2/jak2_config.jsonc`,
    ).fsPath;
  } else if (gameName == GameName.Jak3) {
    decompConfigPath = vscode.Uri.joinPath(
      getProjectRoot(),
      `decompiler/config/jak3/jak3_config.jsonc`,
    ).fsPath;
  }
  if (decompConfigPath === undefined || !existsSync(decompConfigPath)) {
    return undefined;
  } else {
    return decompConfigPath;
  }
}

function getDecompilerConfigVersion(gameName: GameName): string {
  let version = undefined;
  if (gameName == GameName.Jak1) {
    version = getConfig().jak1DecompConfigVersion;
  } else if (gameName == GameName.Jak2) {
    version = getConfig().jak2DecompConfigVersion;
  } else if (gameName == GameName.Jak3) {
    version = getConfig().jak3DecompConfigVersion;
  }
  if (version === undefined) {
    return "ntsc_v1";
  } else {
    return version;
  }
}

async function checkDecompilerPath(): Promise<string | undefined> {
  let decompilerPath = getConfig().decompilerPath;

  // Look for the decompiler if the path isn't set or the file is now missing
  if (decompilerPath !== undefined && existsSync(decompilerPath)) {
    return decompilerPath;
  }

  const potentialPath = vscode.Uri.joinPath(
    getProjectRoot(),
    defaultDecompPath(),
  );
  if (existsSync(potentialPath.fsPath)) {
    decompilerPath = potentialPath.fsPath;
  } else {
    // Ask the user to find it cause we have no idea
    const path = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: "Select Decompiler",
      title: "Provide the decompiler executable's path",
    });
    if (path === undefined || path.length == 0) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Aborting decompilation, you didn't provide a path to the executable",
      );
      return undefined;
    }
    decompilerPath = path[0].fsPath;
  }
  updateDecompilerPath(decompilerPath);
  return decompilerPath;
}

async function checkFormatterPath(): Promise<string | undefined> {
  let formatterPath = getConfig().formatterPath;

  // Look for the decompiler if the path isn't set or the file is now missing
  if (formatterPath !== undefined && existsSync(formatterPath)) {
    return formatterPath;
  }

  const potentialPath = vscode.Uri.joinPath(
    getProjectRoot(),
    defaultFormatterPath(),
  );
  if (existsSync(potentialPath.fsPath)) {
    formatterPath = potentialPath.fsPath;
  } else {
    // Ask the user to find it cause we have no idea
    const path = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: "Select Formatter",
      title: "Provide the formatter executable's path",
    });
    if (path === undefined || path.length == 0) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Aborting formatting, you didn't provide a path to the executable",
      );
      return undefined;
    }
    formatterPath = path[0].fsPath;
  }
  updateFormatterPath(formatterPath);
  return formatterPath;
}

async function decompFiles(
  gameName: GameName,
  fileNames: string[],
  omitVariableCasts: boolean = false,
) {
  const decompConfig = getDecompilerConfig(gameName);
  if (decompConfig === undefined) {
    await vscode.window.showErrorMessage(
      `OpenGOAL - Can't decompile no ${gameName.toString} config selected`,
    );
    return;
  }
  if (fileNames.length == 0) {
    return;
  }
  const decompilerPath = await checkDecompilerPath();
  if (!decompilerPath) {
    return;
  }

  const allowed_objects = fileNames.map((name) => `"${name}"`).join(",");
  updateStatus(DecompStatus.Decompiling, {
    objectNames: fileNames,
    decompConfig: path.parse(decompConfig).name,
  });
  try {
    const args = [
      decompConfig,
      "./iso_data",
      "./decompiler_out",
      "--disable-ansi",
      "--version",
      getDecompilerConfigVersion(gameName),
      "--config-override",
    ];
    if (omitVariableCasts) {
      args.push(
        `{"decompile_code": true, "print_cfgs": true, "levels_extract": false, "ignore_var_name_casts": true,"allowed_objects": [${allowed_objects}]}`,
      );
    } else {
      args.push(
        `{"decompile_code": true, "print_cfgs": true, "levels_extract": false, "allowed_objects": [${allowed_objects}]}`,
      );
    }
    const { stdout, stderr } = await execFileAsync(decompilerPath, args, {
      encoding: "utf8",
      cwd: getProjectRoot()?.fsPath,
      timeout: 20000,
    });
    channel.append(stdout.toString());
    channel.append(stderr.toString());
    updateStatus(DecompStatus.Idle);
  } catch (error: any) {
    updateStatus(DecompStatus.Errored);
    channel.append(
      `DECOMP ERROR:\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}`,
    );
  }

  // Format results
  if (getConfig().formatDecompilationOutput) {
    const formatterPath = await checkFormatterPath();
    if (!formatterPath) {
      return;
    }

    updateStatus(DecompStatus.Formatting, {
      objectNames: fileNames,
      decompConfig: path.parse(decompConfig).name,
    });

    for (const name of fileNames) {
      const filePath = path.join(
        getProjectRoot()?.fsPath,
        "decompiler_out",
        gameName,
        `${name}_disasm.gc`,
      );

      const formatterArgs = ["--write", "--disable-ansi", "--file", filePath];
      try {
        const { stdout, stderr } = await execFileAsync(
          formatterPath,
          formatterArgs,
          {
            encoding: "utf8",
            cwd: getProjectRoot()?.fsPath,
            timeout: 20000,
          },
        );
        channel.append(stdout.toString());
        channel.append(stderr.toString());
      } catch (error: any) {
        updateStatus(DecompStatus.FormattingError);
        channel.append(
          `FORMATTER ERROR:\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}`,
        );
      }
    }
    updateStatus(DecompStatus.Idle);
  }
}

async function getValidObjectNames(gameName: string) {
  // Look for the `all_objs.json` file
  const objsPath = path.join(
    getProjectRoot().fsPath,
    "goal_src",
    gameName,
    "build",
    "all_objs.json",
  );
  if (!existsSync(objsPath)) {
    return undefined;
  }
  const objsData = await fs.readFile(objsPath, {
    encoding: "utf-8",
  });
  const objs = JSON.parse(objsData);
  const names = [];
  for (const obj of objs) {
    const is_tpage = obj[0].includes("tpage");
    const is_art_file = obj[0].endsWith("-ag");
    if (!is_tpage && !is_art_file) {
      names.push(obj[0]);
    }
  }
  return names;
}

async function decompSpecificFile() {
  // Prompt the user for the game name
  let gameName;
  const gameNameSelection = await vscode.window.showQuickPick(
    ["jak1", "jak2", "jak3"],
    {
      title: "Game?",
    },
  );
  if (gameNameSelection === undefined) {
    await vscode.window.showErrorMessage(
      "OpenGOAL - can't decompile, didn't provide a game name",
    );
    return;
  } else {
    if (gameNameSelection == "jak1") {
      gameName = GameName.Jak1;
    } else if (gameNameSelection == "jak2") {
      gameName = GameName.Jak2;
    } else {
      gameName = GameName.Jak3;
    }
  }
  const validNames = await getValidObjectNames(gameNameSelection);
  let fileName;
  if (validNames === undefined || validNames.length <= 0) {
    // Prompt the user for the file name
    fileName = await vscode.window.showInputBox({ title: "Object Name?" });
  } else {
    fileName = await vscode.window.showQuickPick(validNames, {
      title: "File to Decompile?",
    });
  }

  if (fileName === undefined) {
    await vscode.window.showErrorMessage(
      "OpenGOAL - can't decompile, didn't provide an object name",
    );
    return;
  }

  await decompFiles(gameName, [fileName]);
}

async function decompCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't decompile!",
    );
    return;
  }

  let fileName = path.basename(editor.document.fileName);
  if (!fileName.match(/.*_ir2\.asm/)) {
    await vscode.window.showErrorMessage(
      "Current file is not a valid IR2 file, can't decompile!",
    );
    return;
  } else {
    fileName = fileName.split("_ir2.asm")[0];
  }

  // Determine what decomp config to use
  const gameName = determineGameFromPath(editor.document.uri);
  if (gameName === undefined) {
    await vscode.window.showErrorMessage(
      "OpenGOAL - Can't decompile, couldn't determine game from file",
    );
    return;
  }

  await decompFiles(gameName, [fileName]);
}

async function decompAllActiveFiles() {
  let jak1ObjectNames = truncateFileNameEndings(
    getFileNamesFromUris(getUrisFromTabs(/.*jak1\/.*_ir2\.asm/)),
    "_ir2.asm",
  );
  jak1ObjectNames = jak1ObjectNames.concat(
    truncateFileNameEndings(
      getFileNamesFromUris(getUrisFromTabs(/.*jak1\/.*_disasm\.gc/)),
      "_disasm.gc",
    ),
  );
  jak1ObjectNames = [...new Set(jak1ObjectNames)];

  let jak2ObjectNames = truncateFileNameEndings(
    getFileNamesFromUris(getUrisFromTabs(/.*jak2\/.*_ir2\.asm/)),
    "_ir2.asm",
  );
  jak2ObjectNames = jak2ObjectNames.concat(
    truncateFileNameEndings(
      getFileNamesFromUris(getUrisFromTabs(/.*jak2\/.*_disasm\.gc/)),
      "_disasm.gc",
    ),
  );
  jak2ObjectNames = [...new Set(jak2ObjectNames)];

  let jak3ObjectNames = truncateFileNameEndings(
    getFileNamesFromUris(getUrisFromTabs(/.*jak3\/.*_ir2\.asm/)),
    "_ir2.asm",
  );
  jak3ObjectNames = jak3ObjectNames.concat(
    truncateFileNameEndings(
      getFileNamesFromUris(getUrisFromTabs(/.*jak3\/.*_disasm\.gc/)),
      "_disasm.gc",
    ),
  );
  jak3ObjectNames = [...new Set(jak3ObjectNames)];

  if (jak1ObjectNames.length > 0) {
    await decompFiles(GameName.Jak1, jak1ObjectNames);
  }
  if (jak2ObjectNames.length > 0) {
    await decompFiles(GameName.Jak2, jak2ObjectNames);
  }
  if (jak3ObjectNames.length > 0) {
    await decompFiles(GameName.Jak3, jak3ObjectNames);
  }
}

function openManPage() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const document = editor.document;
  const currPosition = editor.selection.anchor;

  // Find the token splitting by word boundaries at the current position
  const wordRange = document.getWordRangeAtPosition(currPosition, /[\w.]+/g);
  if (wordRange === undefined) {
    return;
  }
  const word = document.getText(wordRange);
  open_in_pdf(word);
}

function setupAutoDecompilation() {
  const isEnabled = getConfig().autoDecompilation;
  if (isEnabled && fsWatcher === undefined) {
    fsWatcher = vscode.workspace.createFileSystemWatcher(
      "**/decompiler/config/**/*.{jsonc,json,gc}",
    );
    fsWatcher.onDidChange((uri: vscode.Uri) => {
      decompAllActiveFiles();
      // Also update list of types for that game
      const gameName = determineGameFromPath(uri);
      if (gameName !== undefined) {
        updateTypeCastSuggestions(gameName);
      }
    });
    fsWatcher.onDidCreate(() => decompAllActiveFiles());
    fsWatcher.onDidDelete(() => decompAllActiveFiles());
  }
}

async function toggleAutoDecompilation() {
  const isEnabled = getConfig().autoDecompilation;
  await updateAutoDecompilation(!isEnabled);
  if (!getConfig().autoDecompilation && fsWatcher !== undefined) {
    fsWatcher.dispose();
    fsWatcher = undefined;
  } else if (getConfig().autoDecompilation) {
    setupAutoDecompilation();
  }
  updateStatusBar(false, false);
}

async function updateSourceFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't decompile!",
    );
    return;
  }

  let fileName = path.basename(editor.document.fileName);
  let disasmFilePath = "";
  if (fileName.match(/.*_ir2\.asm/)) {
    disasmFilePath = editor.document.fileName.replace("_ir2.asm", "_disasm.gc");
    fileName = fileName.split("_ir2.asm")[0];
    if (!existsSync(disasmFilePath)) {
      return;
    }
  } else if (fileName.match(/.*_disasm.gc/)) {
    disasmFilePath = editor.document.fileName;
    fileName = fileName.split("_disasm.gc")[0];
  } else {
    return;
  }

  let gameName = "jak1";
  if (editor.document.uri.fsPath.includes("jak2")) {
    gameName = "jak2";
  } else if (editor.document.uri.fsPath.includes("jak3")) {
    gameName = "jak3";
  }

  const { stdout, stderr } = await execAsync(
    `python ./scripts/gsrc/update-from-decomp.py --game ${gameName} --file ${fileName}`,
    {
      encoding: "utf8",
      cwd: getProjectRoot()?.fsPath,
      timeout: 20000,
    },
  );
  updateStatus(DecompStatus.Idle);
  channel.append(stdout.toString());
  channel.append(stderr.toString());
}

async function updateReferenceTest() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't decompile!",
    );
    return;
  }

  // TODO - duplication with above

  let fileName = path.basename(editor.document.fileName);
  let disasmFilePath = "";
  if (fileName.match(/.*_ir2\.asm/)) {
    disasmFilePath = editor.document.fileName.replace("_ir2.asm", "_disasm.gc");
    fileName = fileName.split("_ir2.asm")[0];
    if (!existsSync(disasmFilePath)) {
      return;
    }
  } else if (fileName.match(/.*_disasm.gc/)) {
    disasmFilePath = editor.document.fileName;
    fileName = fileName.split("_disasm.gc")[0];
  } else {
    return;
  }

  let gameName = "jak1";
  if (editor.document.uri.fsPath.includes("jak2")) {
    gameName = "jak2";
  } else if (editor.document.uri.fsPath.includes("jak3")) {
    gameName = "jak3";
  }
  const folderToSearch = vscode.Uri.joinPath(
    getProjectRoot(),
    `goal_src/${gameName}`,
  );
  const files = await glob(`**/${fileName}.gc`, {
    cwd: folderToSearch.fsPath,
  });

  if (files.length == 0 || files.length > 1) {
    return;
  }

  const refTestPath = vscode.Uri.joinPath(
    getProjectRoot(),
    `test/decompiler/reference/${gameName}/${files[0].replace(
      ".gc",
      "_REF.gc",
    )}`,
  ).fsPath;

  const decompContents = await fs.readFile(disasmFilePath, {
    encoding: "utf-8",
  });

  await fs.mkdir(path.dirname(refTestPath), { recursive: true });
  await fs.writeFile(refTestPath, decompContents, {
    encoding: "utf-8",
    flag: "w+",
  });
}

async function compareFunctionWithJak2() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't compare decompiler output!",
    );
    return;
  }
  let fileName = path.basename(editor.document.fileName);
  if (!fileName.match(/.*_ir2\.asm/)) {
    await vscode.window.showErrorMessage(
      "Current file is not a valid IR2 file, can't compare!",
    );
    return;
  } else {
    fileName = fileName.split("_ir2.asm")[0];
  }

  // 0. Determine the current function we are interested in comparing
  const funcName = getFuncNameFromPosition(
    editor.document,
    editor.selection.start,
  );
  if (funcName === undefined) {
    await vscode.window.showErrorMessage(
      "Couldn't determine function name to compare with jak 2!",
    );
    return;
  }
  // 1. Run the decompiler on the same file in jak 2 without variable names
  await decompFiles(GameName.Jak2, [fileName], true);
  // 2. Go grab that file's contents, find the same function and grab it, cut out the docstring if it's there (and save it)
  const decompiledOutput = (
    await fs.readFile(
      path.join(
        getProjectRoot()?.fsPath,
        "decompiler_out",
        "jak2",
        `${fileName}_ir2.asm`,
      ),
    )
  )
    .toString()
    .split("\n");
  let foundFunc = false;
  let foundFuncBody = false;
  const funcBody = [];
  const docstring = [];
  for (const line of decompiledOutput) {
    if (line.includes(`; .function ${funcName}`)) {
      foundFunc = true;
      continue;
    }
    if (foundFunc && line.includes(";;-*-OpenGOAL-Start-*-")) {
      foundFuncBody = true;
      continue;
    }
    if (foundFuncBody) {
      if (line.includes(";;-*-OpenGOAL-End-*-")) {
        break;
      }
      if (line.trim() === ``) {
        continue;
      }
      // NOTE - this will fail with functions with multi-line signatures
      if (
        funcBody.length === 1 &&
        (line.trim().startsWith('"') || !line.trim().startsWith("("))
      ) {
        docstring.push(line.trimEnd());
        continue;
      }
      funcBody.push(line.trimEnd());
    }
  }
  // 3. Compare the two, if they match, then copy over any var-name changes and put the docstring in the clipboard
  const jak3FuncBody = getFuncBodyFromPosition(
    editor.document,
    editor.selection.start,
  );
  if (jak3FuncBody === undefined) {
    await vscode.window.showErrorMessage(
      "Couldn't determine function body in jak 3!",
    );
    return;
  }
  if (funcBody.join("\n") === jak3FuncBody.join("\n")) {
    // Update var casts
    await copyVarCastsFromOneGameToAnother(
      editor.document,
      GameName.Jak2,
      GameName.Jak3,
      funcName,
    );
    await vscode.window.showInformationMessage(
      "Function bodies match! Docstring copied to clipboard if it was found.",
    );
    if (docstring.length > 0) {
      await vscode.env.clipboard.writeText(docstring.join("\n"));
    }
  } else {
    await vscode.window.showWarningMessage("Function bodies don't match!");
  }
}

export async function activateDecompTools() {
  // no color support :( - https://github.com/microsoft/vscode/issues/571
  channel = vscode.window.createOutputChannel(
    "OpenGOAL Decompiler",
    "opengoal-ir",
  );

  setupAutoDecompilation();
  updateStatus(DecompStatus.Idle);

  // Commands
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand("opengoal.decomp.openLogs", () => {
      channel.show();
    }),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand("opengoal.decomp.openManPage", openManPage),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.decompileCurrentFile",
      decompCurrentFile,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.decompileSpecificFile",
      decompSpecificFile,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.toggleAutoDecompilation",
      toggleAutoDecompilation,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.updateSourceFile",
      updateSourceFile,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.updateReferenceTest",
      updateReferenceTest,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.compareFuncWithJak2",
      compareFunctionWithJak2,
    ),
  );

  activateDecompTypeSearcher();
}
