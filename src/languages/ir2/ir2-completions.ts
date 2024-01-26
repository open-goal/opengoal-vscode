import * as vscode from "vscode";
import { getArgumentsInSignature } from "../opengoal/opengoal-tools";
import { getFuncBodyFromPosition } from "./ir2-utils";

export class IRCompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
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
      position.character,
    );

    const funcBody = getFuncBodyFromPosition(document, position);
    if (funcBody === undefined) {
      return [];
    }

    let docstring = `"something\n`;
    for (const arg of args) {
      // Determine the nature of the parameter
      // _ - unused (if it doesn't show up AT ALL)
      // ! - mutated (if it's involved in a set)
      // ? - optional (can't easily determine this and is frankly rare)
      let paramFound = false;
      let paramPrinted = false;
      for (let i = 1; i < funcBody.length; i++) {
        const line = funcBody[i];
        if (line.includes(`(set! (-> ${arg.name}`)) {
          docstring += ` @param! ${arg.name} something\n`;
          paramFound = true;
          paramPrinted = true;
          break;
        } else if (line.includes(arg.name)) {
          paramFound = true;
        }
      }
      if (paramFound && !paramPrinted) {
        docstring += ` @param ${arg.name} something\n`;
      } else if (!paramPrinted) {
        docstring += ` @param_ ${arg.name} something\n`;
      }
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
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CompletionItem> {
    throw new Error("Method not implemented.");
  }
}
