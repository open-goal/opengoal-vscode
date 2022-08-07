import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";

// TODO - remove "most recent ir2 file, and wire it up here when in an `all-types.gc` file"

export enum GameName {
  Jak1,
  Jak2,
}

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

export function determineGameFromPath(path: vscode.Uri): GameName | undefined {
  if (path.fsPath.includes("jak1")) {
    return GameName.Jak1;
  } else if (path.fsPath.includes("jak2")) {
    return GameName.Jak2;
  }
  return undefined;
}

export async function getDirectoriesInDir(dir: string) {
  const dirs = await fs.readdir(dir, { withFileTypes: true });
  return dirs
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}
