import * as vscode from "vscode";
import * as lsp from "./lsp/main";
import {
  setTextmateColors,
  setVSIconAssociations,
} from "./config/user-settings";
import { PdfCustomProvider } from "./vendor/vscode-pdfviewer/pdfProvider";
import { switchFile } from "./utils/FileUtils";
import { activateDecompTools } from "./decomp/decomp-tools";
import { initContext } from "./context";

export async function activate(context: vscode.ExtensionContext) {
  // Init Context
  initContext(context);

  // Init settings that we unfortunately have to manually maintain
  await setVSIconAssociations();
  await setTextmateColors();

  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.switchFile", switchFile)
  );

  activateDecompTools();

  // Customized PDF Viewer
  const provider = new PdfCustomProvider(
    vscode.Uri.file(context.extensionPath)
  );
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

  // Start the LSP
  lsp.activate(context);
}

export function deactivate(): Promise<void> | undefined {
  return lsp.deactivate();
}
