// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { RecentFiles } from "./RecentFiles";
import * as fileUtils from "./utils/FileUtils";
import * as lsp from "./lsp/main";

let recentFiles: RecentFiles;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // TODO - break this out into a separate file
  // Setup users settings, merge with existing ones if they are there
  const userConfig = vscode.workspace.getConfiguration();
  // - https://github.com/vscode-icons/vscode-icons/issues/1363
  // - NOTE this may break situations where a file type is being handled by another extension
  const opengoalAssocs = [
    {
      extensions: ["gs", "gp"],
      language: "opengoal-goos",
    },
    {
      extensions: ["gc", "gd"],
      language: "opengoal",
    },
    {
      extensions: ["asm"],
      language: "opengoal-ir",
    },
  ];
  let currentIconAssociations: any = userConfig.get(
    "vsicons.associations.files"
  );
  if (currentIconAssociations === undefined) {
    currentIconAssociations = opengoalAssocs;
  } else {
    for (const assoc of opengoalAssocs) {
      // Don't add duplicates
      let unique = true;
      for (const existingAssoc of currentIconAssociations) {
        if (
          "extensions" in existingAssoc &&
          existingAssoc.extensions.every(
            (v: string, i: number) => v === assoc.extensions[i]
          ) &&
          "language" in existingAssoc &&
          existingAssoc.language === assoc.language
        ) {
          unique = false;
          break;
        }
      }
      if (unique) {
        currentIconAssociations.push(assoc);
      }
    }
  }
  userConfig.update(
    "vsicons.associations.files",
    currentIconAssociations,
    vscode.ConfigurationTarget.Global
  );

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
  // lsp.activate(context);
}

export function deactivate(): Promise<void> | undefined {
  return lsp.deactivate();
}
