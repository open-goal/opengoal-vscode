import * as vscode from "vscode";
import { RecentFiles } from "./RecentFiles";
import * as fileUtils from "./utils/FileUtils";
import * as lsp from "./lsp/main";
import {
  setTextmateColors,
  setVSIconAssociations,
} from "./config/user-settings";

let recentFiles: RecentFiles;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  setVSIconAssociations();
  setTextmateColors();

  recentFiles = new RecentFiles(context);
  if (vscode.window.activeTextEditor?.document != undefined) {
    recentFiles.addFile(vscode.window.activeTextEditor?.document.fileName);
  }
  // Commands
  // - All
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.switchFile", fileUtils.switchFile)
  );
  // - Decompiling
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.openMostRecentIRFile",
      () => fileUtils.openFile(recentFiles.searchByPrefix("_ir2.asm"))
    )
  );

  // Events
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document != undefined) {
        recentFiles.addFile(editor?.document.fileName);
      }
    })
  );

  // Start the LSP
  lsp.activate(context);
}

export function deactivate(): Promise<void> | undefined {
  return lsp.deactivate();
}
