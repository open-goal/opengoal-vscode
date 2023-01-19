import * as vscode from "vscode";
import { getArgumentsInSignature } from "../opengoal/opengoal-tools";

export class IRCompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    // Currently, this is used to automatically generate docstrings for `defmethods` and `defun`
    // NOTE - assumes single line signatures!

    // Find the signature line
    const prevLine = document.lineAt(position.line - 1).text;
    if (!prevLine.includes("defmethod") && !prevLine.includes("defun")) {
      return [];
    }

    const args = getArgumentsInSignature(prevLine);
    if (args.length <= 0) {
      return [];
    }

    const range = new vscode.Range(position, position);
    const rangeToRemove = new vscode.Range(
      position.line,
      position.character - 1,
      position.line,
      position.character
    );

    let docstring = `"something\n`;
    for (const arg of args) {
      docstring += ` @param ${arg.name} something\n`;
    }
    docstring += ` @returns something"`;

    return [
      {
        label: "Auto-Generated Docstring",
        kind: vscode.CompletionItemKind.Text,
        range: range,
        insertText: docstring,
        additionalTextEdits: [vscode.TextEdit.delete(rangeToRemove)],
      },
    ];
  }

  resolveCompletionItem?(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    throw new Error("Method not implemented.");
  }
}
