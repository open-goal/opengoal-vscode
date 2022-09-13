import { exec, execFile } from "child_process";
import { existsSync, promises as fs, readFileSync } from "fs";
import * as vscode from "vscode";
import { determineGameFromPath, GameName, openFile } from "../utils/file-utils";
import { open_in_pdf } from "./man-page";
import * as util from "util";
import {
  getConfig,
  updateDecompilerPath,
  updateJak1DecompConfig,
  updateJak2DecompConfig,
} from "../config/config";
import * as path from "path";
import * as glob from "glob";
import { getExtensionContext, getRecentFiles } from "../context";
import {
  getFileNamesFromUris,
  getUrisFromTabs,
  getWorkspaceFolderByName,
  truncateFileNameEndings,
} from "../utils/workspace";

const globAsync = util.promisify(glob);
const execFileAsync = util.promisify(execFile);
const execAsync = util.promisify(exec);

// Put some of this stuff into the context
let projectRoot: vscode.Uri | undefined = undefined;

let channel: vscode.OutputChannel;
let fsWatcher: vscode.FileSystemWatcher | undefined;

const decompStatusItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  0
);

enum DecompStatus {
  Idle,
  Running,
}

function updateStatus(status: DecompStatus, metadata?: any) {
  let subText = "";
  switch (status) {
    case DecompStatus.Idle:
      decompStatusItem.tooltip = "Toggle Auto-Decompilation";
      decompStatusItem.command = "opengoal.decomp.toggleAutoDecompilation";
      if (fsWatcher === undefined) {
        decompStatusItem.text =
          "$(extensions-sync-ignored) Auto-Decompilation Disabled";
      } else {
        decompStatusItem.text =
          "$(extensions-sync-enabled) Auto-Decompilation Enabled";
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

async function promptUserToSelectConfig(
  projectRoot: vscode.Uri
): Promise<string | undefined> {
  // Get all `.jsonc` files in ./decompiler/config
  const configs = await globAsync("decompiler/config/*.jsonc", {
    cwd: projectRoot.fsPath,
  });
  const options = [];
  for (const config of configs) {
    options.push(path.basename(config));
  }
  return await vscode.window.showQuickPick(options, {
    title: "Config?",
  });
}

async function getDecompilerConfig(
  gameName: GameName
): Promise<string | undefined> {
  if (projectRoot === undefined) {
    projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return undefined;
    }
  }

  const config = getConfig();
  if (gameName == GameName.Jak1) {
    const decompConfig = config.jak1DecompConfig;
    if (
      decompConfig === undefined ||
      !existsSync(
        vscode.Uri.joinPath(projectRoot, `decompiler/config/${decompConfig}`)
          .fsPath
      )
    ) {
      const config = await promptUserToSelectConfig(projectRoot);
      if (config === undefined) {
        return;
      } else {
        updateJak1DecompConfig(config);
        return config;
      }
    } else {
      return decompConfig;
    }
  } else if (gameName == GameName.Jak2) {
    const decompConfig = config.jak2DecompConfig;
    if (
      decompConfig === undefined ||
      !existsSync(
        vscode.Uri.joinPath(projectRoot, `decompiler/config/${decompConfig}`)
          .fsPath
      )
    ) {
      const config = await promptUserToSelectConfig(projectRoot);
      if (config === undefined) {
        return;
      } else {
        updateJak2DecompConfig(config);
        return config;
      }
    } else {
      return decompConfig;
    }
  }
  return undefined;
}

async function checkDecompilerPath(): Promise<string | undefined> {
  if (projectRoot === undefined) {
    projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return undefined;
    }
  }

  let decompilerPath = getConfig().decompilerPath;

  // Look for the decompiler if the path isn't set or the file is now missing
  if (decompilerPath !== undefined && existsSync(decompilerPath)) {
    return decompilerPath;
  }

  const potentialPath = vscode.Uri.joinPath(projectRoot, defaultDecompPath());
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

async function decompFiles(decompConfig: string, fileNames: string[]) {
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
    decompConfig: decompConfig,
  });
  try {
    const { stdout, stderr } = await execFileAsync(
      decompilerPath,
      [
        `./decompiler/config/${decompConfig}`,
        "./iso_data",
        "./decompiler_out",
        "--config-override",
        `{"decompile_code": true, "allowed_objects": [${allowed_objects}]}`,
      ],
      {
        encoding: "utf8",
        cwd: projectRoot?.fsPath,
        timeout: 20000,
      }
    );
    channel.append(stdout.toString());
    channel.append(stderr.toString());
  } catch (error: any) {
    vscode.window.showErrorMessage(
      "Decompilation Failed, see OpenGOAL Decompiler logs for details"
    );
    channel.append(
      `DECOMP ERROR:\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}`
    );
  }
  updateStatus(DecompStatus.Idle);
}

async function getValidObjectNames(gameName: string) {
  if (projectRoot === undefined) {
    projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      return undefined;
    }
  }

  // Look for the `all_objs.json` file
  const objsPath = path.join(
    projectRoot.fsPath,
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
  const decompConfig = await getDecompilerConfig(gameName);
  if (decompConfig === undefined) {
    await vscode.window.showErrorMessage(
      `OpenGOAL - Can't decompile no ${gameName.toString} config selected`
    );
    return;
  }

  await decompFiles(decompConfig, [fileName]);
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
  const gameName = await determineGameFromPath(editor.document.uri);
  if (gameName === undefined) {
    await vscode.window.showErrorMessage(
      "OpenGOAL - Can't decompile, couldn't determine game from file"
    );
    return;
  }
  const decompConfig = await getDecompilerConfig(gameName);
  if (decompConfig === undefined) {
    await vscode.window.showErrorMessage(
      `OpenGOAL - Can't decompile no ${gameName.toString} config selected`
    );
    return;
  }

  await decompFiles(decompConfig, [fileName]);
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
    const jak1Config = await getDecompilerConfig(GameName.Jak1);
    if (jak1Config === undefined) {
      await vscode.window.showErrorMessage(
        "OpenGOAL - Can't decompile no Jak 1 config selected"
      );
      return;
    }
    await decompFiles(jak1Config, jak1ObjectNames);
  }

  if (jak2ObjectNames.length > 0) {
    const jak2Config = await getDecompilerConfig(GameName.Jak2);
    if (jak2Config === undefined) {
      await vscode.window.showErrorMessage(
        "OpenGOAL - Can't decompile no Jak 2 config selected"
      );
      return;
    }
    await decompFiles(jak2Config, jak2ObjectNames);
  }
}

function openMostRecentIRFile() {
  openFile(getRecentFiles().searchByPrefix("_ir2.asm"));
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
    fsWatcher.onDidChange(() => decompAllActiveFiles());
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

  if (projectRoot === undefined) {
    projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return undefined;
    }
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
      cwd: projectRoot?.fsPath,
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

  if (projectRoot === undefined) {
    projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return undefined;
    }
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
    projectRoot,
    `goal_src/${gameName}`
  );
  const files = await globAsync(`**/${fileName}.gc`, {
    cwd: folderToSearch.fsPath,
  });

  if (files.length == 0 || files.length > 1) {
    return;
  }

  const refTestPath = vscode.Uri.joinPath(
    projectRoot,
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
    vscode.commands.registerCommand(
      "opengoal.decomp.openMostRecentIRFile",
      openMostRecentIRFile
    )
  );
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
}
