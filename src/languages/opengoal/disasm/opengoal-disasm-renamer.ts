import * as vscode from "vscode";
import { updateVarCasts } from "../../../decomp/utils";
import { getSymbolAtPosition } from "../../common/utils";
import {
  determineCurrentFunctionName,
  getSymbolsArgumentInfo,
} from "../opengoal-tools";

export class OpenGOALDisasmRenameProvider implements vscode.RenameProvider {
  public async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken
  ): Promise<vscode.WorkspaceEdit | undefined> {
    const symbol = getSymbolAtPosition(document, position);
    if (symbol === undefined) {
      return;
    }

    const line = document.lineAt(position.line).text;
    const argMeta = getSymbolsArgumentInfo(line, symbol);
    const funcName = determineCurrentFunctionName(document, position);
    if (funcName === undefined) {
      return;
    }

    await updateVarCasts(document, funcName, argMeta, symbol, newName);

    // The actual renaming is done by the decompiler, which happens automatically if
    // auto decompilation is enabled
    return;
  }
}
