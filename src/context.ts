// A context class to hold common information any part of the extension might be interested in accessing

import * as vscode from "vscode";
import { RecentFiles } from "./RecentFiles";

let extensionContext: vscode.ExtensionContext;
let recentFiles: RecentFiles;

export function initContext(extContext: vscode.ExtensionContext) {
  extensionContext = extContext;

  recentFiles = new RecentFiles(extensionContext);
  if (vscode.window.activeTextEditor?.document != undefined) {
    recentFiles.addFile(vscode.window.activeTextEditor?.document.fileName);
  }
}

export function getRecentFiles() {
  return recentFiles;
}

export function getExtensionContext() {
  return extensionContext;
}
