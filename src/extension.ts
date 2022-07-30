import * as vscode from "vscode";
import { RecentFiles } from "./RecentFiles";
import * as lsp from "./lsp/main";
import {
  setTextmateColors,
  setVSIconAssociations,
} from "./config/user-settings";
import { PdfCustomProvider } from "./vendor/vscode-pdfviewer/pdfProvider";
import { switchFile } from "./utils/FileUtils";
import { activateDecompTools } from "./decomp/decomp-tools";

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

  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.switchFile", switchFile)
  );

  activateDecompTools(context, recentFiles);

  // Customized PDF Viewer
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
