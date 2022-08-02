import * as vscode from "vscode";
import * as lsp from "./lsp/main";
import {
  setTextmateColors,
  setVSIconAssociations,
} from "./config/user-settings";
import { PdfCustomProvider } from "./vendor/vscode-pdfviewer/pdfProvider";
import { switchFile } from "./utils/file-utils";
import { activateDecompTools } from "./decomp/decomp-tools";
import { initContext } from "./context";
import { IRFoldingRangeProvider } from "./languages/ir2-folder";
import { activateTypeCastTools } from "./decomp/type-caster";

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
  activateTypeCastTools();

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

  // TODO - disposable stuff?

  // Language Customizations
  vscode.languages.registerFoldingRangeProvider(
    { scheme: "file", language: "opengoal-ir" },
    new IRFoldingRangeProvider()
  );

  // Start the LSP
  lsp.activate(context);
}

export function deactivate(): Promise<void> | undefined {
  return lsp.deactivate();
}
