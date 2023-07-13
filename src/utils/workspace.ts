import * as vscode from "vscode";
import * as path from "path";

export function getUrisFromTabs(pathRegex: RegExp): vscode.Uri[] {
  const uris = [];
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        const uri = tab.input.uri;
        if (!uri.path.match(pathRegex)) {
          continue;
        }
        uris.push(uri);
      }
    }
  }

  return uris;
}

export function getFileNamesFromUris(uris: vscode.Uri[]): string[] {
  return uris.map((uri) => path.basename(uri.fsPath));
}

export function truncateFileNameEndings(
  names: string[],
  toRemove: string,
): string[] {
  return names.map((name) => name.split(toRemove)[0]);
}

export function getWorkspaceFolderByName(name: string): vscode.Uri | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (folders === undefined) {
    return undefined;
  }
  for (const folder of folders) {
    if (folder.name == name) {
      return folder.uri;
    }
  }
  return undefined;
}
