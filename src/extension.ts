import * as vscode from "vscode";
import * as lsp from "./lsp/main";
import {
  setTextmateColors,
  setVSIconAssociations,
} from "./config/user-settings";
import { PdfCustomProvider } from "./vendor/vscode-pdfviewer/pdfProvider";
import { switchFile } from "./utils/file-utils";
import { activateDecompTools } from "./decomp/decomp-tools";
import { getMainChannel, initContext } from "./context";
import { IRFoldingRangeProvider } from "./languages/ir2/ir2-folder";
import { activateTypeCastTools } from "./decomp/type-caster";
import { IRInlayHintsProvider } from "./languages/ir2/ir2-inlay-hinter";
import { OpenGOALDisasmRenameProvider } from "./languages/opengoal/disasm/opengoal-disasm-renamer";
import { activateMiscDecompTools } from "./decomp/misc-tools";

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Init Context
    initContext(context);

    // Init settings that we unfortunately have to manually maintain
    await setVSIconAssociations();
    await setTextmateColors();

    vscode.workspace.onDidChangeConfiguration(async (event) => {
      await setTextmateColors();
    });

    context.subscriptions.push(
      vscode.commands.registerCommand("opengoal.switchFile", switchFile)
    );

    activateDecompTools();
    activateTypeCastTools();
    activateMiscDecompTools();

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
    vscode.languages.registerInlayHintsProvider(
      { scheme: "file", language: "opengoal-ir" },
      new IRInlayHintsProvider()
    );
    vscode.languages.registerRenameProvider(
      { scheme: "file", language: "opengoal", pattern: "**/*_disasm.gc" },
      new OpenGOALDisasmRenameProvider()
    );

    // Start the LSP
    lsp.activate(context);
  } catch (err) {
    vscode.window.showErrorMessage(
      "Failed to activate OpenGOAL extension, see logs for details"
    );
    getMainChannel().append(`Failed to activate extension - ${err}`);
  }
}

export function deactivate(): Promise<void> | undefined {
  return lsp.deactivate();
}
