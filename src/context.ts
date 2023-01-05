// A context class to hold common information any part of the extension might be interested in accessing

import * as vscode from "vscode";
import { RecentFiles } from "./RecentFiles";
import { getWorkspaceFolderByName } from "./utils/workspace";

const channel = vscode.window.createOutputChannel("OpenGOAL");
let extensionContext: vscode.ExtensionContext;
let recentFiles: RecentFiles;
let projectRoot: vscode.Uri | undefined = undefined;

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

export function getMainChannel() {
  return channel;
}

export function getProjectRoot(): vscode.Uri {
  if (projectRoot === undefined) {
    projectRoot = getWorkspaceFolderByName("jak-project");
    // if it's still undefined, throw an error
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      throw new Error("unable to locate 'jak-project' workspace folder");
    }
  }
  return projectRoot;
}
