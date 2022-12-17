import * as vscode from "vscode";

export function getEditorRange(editor: vscode.TextEditor) {
  const document = editor.document;
  const invalidRange = new vscode.Range(0, 0, document.lineCount + 5, 0);
  return document.validateRange(invalidRange);
}
