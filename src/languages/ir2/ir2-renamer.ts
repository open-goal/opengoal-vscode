import * as vscode from "vscode";
import { updateVarCasts } from "../../decomp/utils";
import { getSymbolAtPosition } from "../common/utils";
import { getSymbolsArgumentInfo } from "../opengoal/opengoal-tools";
import { getFuncNameFromPosition, insideGoalCodeInIR } from "./ir2-utils";

export class IRRenameProvider implements vscode.RenameProvider {
  public async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken,
  ): Promise<vscode.WorkspaceEdit | undefined> {
    const symbol = getSymbolAtPosition(document, position);
    if (symbol === undefined) {
      return;
    }

    // Check that we are actually inside an OpenGOAL function
    if (!insideGoalCodeInIR(document, position)) {
      return;
    }

    const line = document.lineAt(position.line).text;
    const argMeta = getSymbolsArgumentInfo(line, symbol);
    // We can determine the function in a more consistent way here, that will also allow
    // for renaming anon-functions / states / etc
    const funcName = await getFuncNameFromPosition(document, position);
    if (funcName === undefined) {
      return;
    }

    await updateVarCasts(document, funcName, argMeta, symbol, newName);

    // The actual renaming is done by the decompiler, which happens automatically if
    // auto decompilation is enabled
    return;
  }
}
