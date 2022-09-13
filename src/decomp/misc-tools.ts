import { getExtensionContext } from "../context";
import * as vscode from "vscode";

async function addToOffsets() {
  const editor = vscode.window.activeTextEditor;
  if (
    editor === undefined ||
    editor.selection.isEmpty ||
    editor.selection.isSingleLine
  ) {
    return;
  }

  // Get amount to increment
  const incString = await vscode.window.showInputBox({
    title: "Increment By?",
  });
  if (incString === undefined) {
    return;
  }
  const incAmount = parseInt(incString);

  editor.edit((selectedText) => {
    // Get the content of the selection
    const content = editor.document.getText(editor.selection);

    // Increment all values after `:offset` or `:offset-assert`
    const result = content.replace(
      /(?<=offset(?:-assert)?\s+)(\d+)(?=\s+|\))/g,
      (match, key) => {
        console.log(`${match}-${key}`);
        return `${parseInt(key) + incAmount}`;
      }
    );

    selectedText.replace(editor.selection, result);
  });
}

export async function activateMiscDecompTools() {
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.addToOffsets",
      addToOffsets
    )
  );
}
