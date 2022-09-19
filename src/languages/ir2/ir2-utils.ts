import * as vscode from "vscode";

// Checks if we are inside the decompiler's output within the IR2 file
// This is somewhat guaranteed by the fact that this is how the embded syntax highlighting works
export function insideGoalCodeInIR(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  // Somewhat primitive, walk back until we find a `;;-*-OpenGOAL-Start-*-` before we find a `.function`
  let idx = position.line;
  while (idx > 0) {
    const line = document.lineAt(idx).text;
    if (line.includes(";;-*-OpenGOAL-Start-*-")) {
      return true;
    }
    if (line.includes(".function")) {
      return false;
    }
    idx--;
  }
  return false;
}

export async function getFuncNameFromPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<string | undefined> {
  const funcNameRegex = /; \.function (.*).*/g;
  for (let i = position.line; i >= 0; i--) {
    const line = document.lineAt(i).text;
    const matches = [...line.matchAll(funcNameRegex)];
    if (matches.length == 1) {
      return matches[0][1].toString();
    }
  }
  await vscode.window.showErrorMessage(
    "Couldn't determine function or method name"
  );
  return undefined;
}

export async function getFuncNameFromSelection(
  document: vscode.TextDocument,
  selection: vscode.Selection
): Promise<string | undefined> {
  return await getFuncNameFromPosition(document, selection.start);
}
