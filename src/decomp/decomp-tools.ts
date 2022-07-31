import { execFile } from "child_process";
import { existsSync } from "fs";
import * as vscode from "vscode";
import { RecentFiles } from "../RecentFiles";
import { openFile } from "../utils/FileUtils";
import { open_in_pdf } from "./man-page";
import * as util from "util";
import { getConfig } from "../config/config";
import * as path from "path";

const execFileAsync = util.promisify(execFile);

// Put some of this stuff into the context
let recentFiles: RecentFiles;
let decompilerPath: string | undefined = undefined;
let folderRootPath: string | undefined = undefined;
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

function openMostRecentIRFile() {
  openFile(recentFiles.searchByPrefix("_ir2.asm"));
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

async function decompFiles(decompConfig: string, fileNames: string[]) {
  if (fileNames.length == 0) {
    return;
  }
  if (decompilerPath == undefined || folderRootPath == undefined) {
    return;
  }
  const allowed_objects = fileNames.map((name) => `"${name}"`).join(",");
  updateStatus(DecompStatus.Running, {
    objectNames: fileNames,
    decompConfig: decompConfig,
  });
  const { stdout, stderr } = await execFileAsync(
    decompilerPath,
    [
      `./decompiler/config/${decompConfig}`,
      "./iso_data",
      "./decompiler_out",
      "--config-override",
      `{"allowed_objects": [${allowed_objects}]}`,
    ],
    {
      encoding: "utf8",
      cwd: folderRootPath,
      timeout: 20000,
    }
  );
  updateStatus(DecompStatus.Idle);
  channel.append(stdout.toString());
  channel.append(stderr.toString());
}

async function decompCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document === undefined) {
    // TODO - errors
    return;
  }
  const folderRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (!folderRoot) {
    return;
  }

  let fileName = path.basename(editor.document.fileName);
  if (!fileName.match(/.*_ir2\.asm/)) {
    return;
  } else {
    fileName = fileName.split("_ir2.asm")[0];
  }

  // Look for the decompiler if the path isn't set.
  if (decompilerPath !== undefined && !existsSync(decompilerPath)) {
    // If the path is set, ensure it actually exists!
    decompilerPath = undefined;
  }

  if (decompilerPath === undefined) {
    const potentialPath = vscode.Uri.joinPath(
      folderRoot.uri,
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
        return;
      }
      decompilerPath = path[0].fsPath;
    }
  }

  // Save path in settings!
  folderRootPath = folderRoot.uri.fsPath;

  // Determine what decomp config to use
  const config = getConfig();
  let tempTest;
  if (editor.document.uri.fsPath.includes("jak1")) {
    // TODO - ask user for it if it doesn't exist!
    tempTest = "something.jsonc";
  } else {
    tempTest = "jak2_ntsc_v1.jsonc";
  }

  await decompFiles(tempTest, [fileName]);

  console.log(decompilerPath);
}

async function decompAllActiveFiles() {
  const jak1Files = [];
  const jak2Files = [];
  let folderRoot;
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        const uri = tab.input.uri;
        const fileName = path.basename(uri.fsPath);
        if (!fileName.match(/.*_ir2\.asm/)) {
          continue;
        }

        // TODO - assumes everything is in the same workspace folder
        if (folderRootPath === undefined) {
          folderRoot = vscode.workspace.getWorkspaceFolder(uri);
          if (folderRoot !== undefined) {
            folderRootPath = folderRoot.uri.fsPath;
          }
        }

        const objectName = fileName.split("_ir2.asm")[0];
        if (uri.fsPath.includes("jak1")) {
          jak1Files.push(objectName);
        } else {
          jak2Files.push(objectName);
        }
      }
    }
  }

  // Duplication
  // Look for the decompiler if the path isn't set.
  if (decompilerPath !== undefined && !existsSync(decompilerPath)) {
    // If the path is set, ensure it actually exists!
    decompilerPath = undefined;
  }

  if (decompilerPath === undefined && folderRoot !== undefined) {
    const potentialPath = vscode.Uri.joinPath(
      folderRoot.uri,
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
        return;
      }
      decompilerPath = path[0].fsPath;
    }
  }

  await decompFiles("jak1_ntsc_black_label.jsonc", jak1Files);
  await decompFiles("jak2_ntsc_v1.jsonc", jak2Files);
}

export async function activateDecompTools(
  context: vscode.ExtensionContext,
  _recentFiles: RecentFiles
) {
  // no color support :( - https://github.com/microsoft/vscode/issues/571
  channel = vscode.window.createOutputChannel(
    "OpenGOAL Decompiler",
    "opengoal-ir"
  );

  recentFiles = _recentFiles;

  toggleAutoDecompilation();

  updateStatus(DecompStatus.Idle);
  decompStatusItem.show();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.openMostRecentIRFile",
      openMostRecentIRFile
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.decomp.openManPage", openManPage)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.decompileCurrentFile",
      decompCurrentFile
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.toggleAutoDecompilation",
      toggleAutoDecompilation
    )
  );
}
