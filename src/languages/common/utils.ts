import * as vscode from "vscode";

export function getSymbolAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  const symbolRange = document.getWordRangeAtPosition(position, /[^\s()]+/g);
  if (symbolRange === undefined) {
    return;
  }
  return document.getText(symbolRange);
}
