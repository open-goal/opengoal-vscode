import { execFile, execFileSync } from "child_process";
import { existsSync, fstatSync } from "fs";
import * as vscode from "vscode";
import { RecentFiles } from "../RecentFiles";
import { openFile } from "../utils/FileUtils";
import { open_in_pdf } from "./man-page";
import * as util from "util";
import { getConfig } from "../config/config";
import * as path from "path";

// Put some of this stuff into the context
let recentFiles: RecentFiles;
let decompilerPath: string | undefined = undefined;
let folderRootPath: string | undefined = undefined;
let channel: vscode.OutputChannel;

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

function decompFiles(decompConfig: string, fileNames: string[]) {
  if (decompilerPath == undefined || folderRootPath == undefined) {
    return;
  }
  const allowed_objects = fileNames.map((name) => `"${name}"`).join(",");
  // TODO - status update somewhere
  const stdout = execFileSync(
    decompilerPath,
    [
      `./decompiler/config/${decompConfig}`,
      "./iso_data",
      "./decompiler_out",
      "--config-override",
      `{"allowed_objects": [${allowed_objects}]}`,
    ],
    {
      cwd: folderRootPath,
      timeout: 20000,
    }
  );
  // TODO - finish status
  channel.append(stdout.toString());
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

  decompFiles(tempTest, [fileName]);

  console.log(decompilerPath);
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
}
