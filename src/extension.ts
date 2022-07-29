import * as vscode from "vscode";
import { RecentFiles } from "./RecentFiles";
import * as fileUtils from "./utils/FileUtils";
import * as lsp from "./lsp/main";
import {
  setTextmateColors,
  setVSIconAssociations,
} from "./config/user-settings";
import { PdfCustomProvider } from "./vendor/vscode-pdfviewer/pdfProvider";
import { open_in_pdf } from "./decomp/man-page";

let recentFiles: RecentFiles;
let provider: PdfCustomProvider;

export async function activate(context: vscode.ExtensionContext) {
  const extensionRoot = vscode.Uri.file(context.extensionPath);

  // Init settings that we unfortunately have to manually maintain
  await setVSIconAssociations();
  await setTextmateColors();

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

  provider = new PdfCustomProvider(extensionRoot);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      PdfCustomProvider.viewType,
      provider,
      {
        webviewOptions: {
          enableFindWidget: false, // default
          retainContextWhenHidden: true,
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.decomp.openManPage", (evt) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const document = editor.document;
      const currPosition = editor.selection.anchor;

      // Find the token splitting by word boundaries at the current position
      const wordRange = document.getWordRangeAtPosition(
        currPosition,
        /[\w.]+/g
      );
      if (wordRange === undefined) {
        return;
      }
      const word = document.getText(wordRange);
      open_in_pdf(word);
    })
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
