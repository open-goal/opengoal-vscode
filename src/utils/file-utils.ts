import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import { getRecentFiles } from "../context";

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
  // all-types is handled a little different, we find the most recent IR2 file
  if (currName === "all-types.gc") {
    openFile(getRecentFiles().searchByPrefix("_ir2.asm"));
  }
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

export function determineGameFromAllTypes(
  path: vscode.Uri
): GameName | undefined {
  if (path.fsPath.includes("jak2")) {
    return GameName.Jak2;
  }
  // jak 1 isn't in it's own folder sadly
  return GameName.Jak1;
}

export async function getDirectoriesInDir(dir: string) {
  const dirs = await fs.readdir(dir, { withFileTypes: true });
  return dirs
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

async function* walkForName(dir: string, name: string): any {
  for await (const d of await fs.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) {
      yield* walkForName(entry, name);
    } else if (d.isFile() && d.name == name) {
      yield entry;
    }
  }
}

export async function findFileInGoalSrc(
  rootFolder: vscode.Uri,
  gameName: string,
  fileName: string
): Promise<string | undefined> {
  const searchFolder = vscode.Uri.joinPath(
    rootFolder,
    "goal_src",
    gameName
  ).fsPath;

  if (!fileName.includes(".gc")) {
    fileName = `${fileName}.gc`;
  }

  const paths = [];
  for await (const path of walkForName(searchFolder, fileName)) {
    paths.push(path);
  }
  if (paths.length === 0) {
    return undefined;
  }
  return paths[0];
}

export async function updateFileBeforeDecomp(
  filePath: string,
  content: string
) {
  const fileContents = await fs.readFile(filePath, "utf-8");
  const fileLines = fileContents.split(/\r?\n/);
  const newLines = [];
  for (const line of fileLines) {
    if (line.toLowerCase().includes(";; decomp begins")) {
      newLines.push(content);
      newLines.push("\n");
    }
    newLines.push(line);
  }
  await fs.writeFile(filePath, newLines.join("\n"));
}
