import { exec, execFile } from "child_process";
import { existsSync, promises as fs } from "fs";
import * as vscode from "vscode";
import { determineGameFromPath, GameName } from "../utils/file-utils";
import { open_in_pdf } from "./man-page";
import * as util from "util";
import { getConfig, updateDecompilerPath } from "../config/config";
import * as path from "path";
import { getExtensionContext, getProjectRoot } from "../context";
import {
  getFileNamesFromUris,
  getUrisFromTabs,
  truncateFileNameEndings,
} from "../utils/workspace";
import { activateDecompTypeSearcher } from "./type-searcher/type-searcher";
import { updateTypeCastSuggestions } from "./type-caster";
import { glob } from "glob";

const execFileAsync = util.promisify(execFile);
const execAsync = util.promisify(exec);

let channel: vscode.OutputChannel;
let fsWatcher: vscode.FileSystemWatcher | undefined;

const decompStatusItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  0
);

enum DecompStatus {
  Idle,
  Running,
  Errored,
}

function updateStatus(status: DecompStatus, metadata?: any) {
  let subText = "";
  switch (status) {
    case DecompStatus.Errored:
      decompStatusItem.tooltip = "Toggle Auto-Decomp";
      decompStatusItem.command = "opengoal.decomp.toggleAutoDecompilation";
      decompStatusItem.text = "$(testing-error-icon) Decomp Failed";
      break;
    case DecompStatus.Idle:
      decompStatusItem.tooltip = "Toggle Auto-Decomp";
      decompStatusItem.command = "opengoal.decomp.toggleAutoDecompilation";
      if (fsWatcher === undefined) {
        decompStatusItem.text =
          "$(extensions-sync-ignored) Auto-Decomp Disabled";
      } else {
        decompStatusItem.text =
          "$(extensions-sync-enabled) Auto-Decomp Enabled";
      }
      break;
    case DecompStatus.Running:
      if (metadata.objectNames.length > 0) {
        if (metadata.objectNames.length <= 5) {
          subText = metadata.objectNames.join(", ");
        } else {
          subText = `${metadata.objectNames.slice(0, 5).join(", ")}, and ${
            metadata.objectNames.length - 5
          } more`;
        }
      }
      decompStatusItem.text = `$(loading~spin) Decompiling - ${subText} - [ ${metadata.decompConfig} ]`;
      decompStatusItem.tooltip = "Decompiling...";
      decompStatusItem.command = undefined;
      break;
    default:
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

function getDecompilerConfig(gameName: GameName): string | undefined {
  let decompConfigPath = undefined;
  if (gameName == GameName.Jak1) {
    decompConfigPath = vscode.Uri.joinPath(
      getProjectRoot(),
      `decompiler/config/jak1/jak1_config.jsonc`
    ).fsPath;
  } else if (gameName == GameName.Jak2) {
    decompConfigPath = vscode.Uri.joinPath(
      getProjectRoot(),
      `decompiler/config/jak2/jak2_config.jsonc`
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
    defaultDecompPath()
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
        "OpenGOAL - Aborting decompilation, you didn't provide a path to the executable"
      );
      return undefined;
    }
    decompilerPath = path[0].fsPath;
  }
  updateDecompilerPath(decompilerPath);
  return decompilerPath;
}

async function decompFiles(
  decompConfig: string,
  gameName: GameName,
  fileNames: string[]
) {
  if (fileNames.length == 0) {
    return;
  }
  const decompilerPath = await checkDecompilerPath();
  if (!decompilerPath) {
    return;
  }

  const allowed_objects = fileNames.map((name) => `"${name}"`).join(",");
  updateStatus(DecompStatus.Running, {
    objectNames: fileNames,
    decompConfig: path.parse(decompConfig).name,
  });
  try {
    const args = [
      decompConfig,
      "./iso_data",
      "./decompiler_out",
      "--version",
      getDecompilerConfigVersion(gameName),
      "--config-override",
      `{"decompile_code": true, "levels_extract": false, "allowed_objects": [${allowed_objects}]}`,
    ];
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
      `DECOMP ERROR:\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}`
    );
  }
}

async function getValidObjectNames(gameName: string) {
  // Look for the `all_objs.json` file
  const objsPath = path.join(
    getProjectRoot().fsPath,
    "goal_src",
    gameName,
    "build",
    "all_objs.json"
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
    if (obj[2] != 3) {
      continue;
    }
    names.push(obj[0]);
  }
  return names;
}

async function decompSpecificFile() {
  // Prompt the user for the game name
  let gameName;
  const gameNameSelection = await vscode.window.showQuickPick(
    ["jak1", "jak2"],
    {
      title: "Game?",
    }
  );
  if (gameNameSelection === undefined) {
    await vscode.window.showErrorMessage(
      "OpenGOAL - can't decompile, didn't provide a game name"
    );
    return;
  } else {
    if (gameNameSelection == "jak1") {
      gameName = GameName.Jak1;
    } else {
      gameName = GameName.Jak2;
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
      "OpenGOAL - can't decompile, didn't provide an object name"
    );
    return;
  }

  // Determine what decomp config to use
  const decompConfig = getDecompilerConfig(gameName);
  if (decompConfig === undefined) {
    await vscode.window.showErrorMessage(
      `OpenGOAL - Can't decompile no ${gameName.toString} config selected`
    );
    return;
  }

  await decompFiles(decompConfig, gameName, [fileName]);
}

async function decompCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't decompile!"
    );
    return;
  }

  let fileName = path.basename(editor.document.fileName);
  if (!fileName.match(/.*_ir2\.asm/)) {
    await vscode.window.showErrorMessage(
      "Current file is not a valid IR2 file, can't decompile!"
    );
    return;
  } else {
    fileName = fileName.split("_ir2.asm")[0];
  }

  // Determine what decomp config to use
  const gameName = determineGameFromPath(editor.document.uri);
  if (gameName === undefined) {
    await vscode.window.showErrorMessage(
      "OpenGOAL - Can't decompile, couldn't determine game from file"
    );
    return;
  }
  const decompConfig = getDecompilerConfig(gameName);
  if (decompConfig === undefined) {
    await vscode.window.showErrorMessage(
      `OpenGOAL - Can't decompile no ${gameName.toString} config selected`
    );
    return;
  }

  await decompFiles(decompConfig, gameName, [fileName]);
}

async function decompAllActiveFiles() {
  const jak1ObjectNames = truncateFileNameEndings(
    getFileNamesFromUris(getUrisFromTabs(/.*jak1\/.*_ir2\.asm/)),
    "_ir2.asm"
  );
  const jak2ObjectNames = truncateFileNameEndings(
    getFileNamesFromUris(getUrisFromTabs(/.*jak2\/.*_ir2\.asm/)),
    "_ir2.asm"
  );

  if (jak1ObjectNames.length > 0) {
    const jak1Config = getDecompilerConfig(GameName.Jak1);
    if (jak1Config === undefined) {
      await vscode.window.showErrorMessage(
        "OpenGOAL - Can't decompile no Jak 1 config selected"
      );
      return;
    }
    await decompFiles(jak1Config, GameName.Jak1, jak1ObjectNames);
  }

  if (jak2ObjectNames.length > 0) {
    const jak2Config = getDecompilerConfig(GameName.Jak2);
    if (jak2Config === undefined) {
      await vscode.window.showErrorMessage(
        "OpenGOAL - Can't decompile no Jak 2 config selected"
      );
      return;
    }
    await decompFiles(jak2Config, GameName.Jak2, jak2ObjectNames);
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

function toggleAutoDecompilation() {
  if (fsWatcher === undefined) {
    fsWatcher = vscode.workspace.createFileSystemWatcher(
      "**/decompiler/config/**/*.{jsonc,json,gc}"
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
  } else {
    fsWatcher.dispose();
    fsWatcher = undefined;
  }
  updateStatus(DecompStatus.Idle);
}

async function updateSourceFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't decompile!"
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
  }

  const { stdout, stderr } = await execAsync(
    `python ./scripts/gsrc/update-from-decomp.py --game ${gameName} --file ${fileName}`,
    {
      encoding: "utf8",
      cwd: getProjectRoot()?.fsPath,
      timeout: 20000,
    }
  );
  updateStatus(DecompStatus.Idle);
  channel.append(stdout.toString());
  channel.append(stderr.toString());
}

async function updateReferenceTest() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't decompile!"
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
  }
  const folderToSearch = vscode.Uri.joinPath(
    getProjectRoot(),
    `goal_src/${gameName}`
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
      "_REF.gc"
    )}`
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

export async function activateDecompTools() {
  // no color support :( - https://github.com/microsoft/vscode/issues/571
  channel = vscode.window.createOutputChannel(
    "OpenGOAL Decompiler",
    "opengoal-ir"
  );

  toggleAutoDecompilation();

  updateStatus(DecompStatus.Idle);
  decompStatusItem.show();

  // Commands
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand("opengoal.decomp.openManPage", openManPage)
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.decompileCurrentFile",
      decompCurrentFile
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.decompileSpecificFile",
      decompSpecificFile
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.toggleAutoDecompilation",
      toggleAutoDecompilation
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.updateSourceFile",
      updateSourceFile
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.updateReferenceTest",
      updateReferenceTest
    )
  );

  activateDecompTypeSearcher();
}
