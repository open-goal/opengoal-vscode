import * as vscode from "vscode";
import * as path from "path";

// TODO - remove "most recent ir2 file, and wire it up here when in an `all-types.gc` file"

const fileSwitchingAssoc = {
  "_ir2.asm": "_disasm.gc",
  "_disasm.gc": "_ir2.asm",
};

export function switchFile() {
  const currPath = vscode.window.activeTextEditor?.document.fileName;
  if (currPath === undefined) {
    return;
  }
  const currName = path.basename(currPath);
  for (const [key, value] of Object.entries(fileSwitchingAssoc)) {
    if (currName.endsWith(key)) {
      // Get everything before the suffix, check if a file with the associated suffix exists
      const prefix = currName.slice(0, -key.length);
      const switchFileName = prefix + value;
      const switchFilePath = path.join(path.dirname(currPath), switchFileName);
      vscode.window.showTextDocument(vscode.Uri.file(switchFilePath));
      return;
    }
  }
}

export function openFile(filePath: string | undefined) {
  if (filePath === undefined) {
    return;
  }
  vscode.window.showTextDocument(vscode.Uri.file(filePath));
}
