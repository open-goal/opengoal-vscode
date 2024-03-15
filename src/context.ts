// A context class to hold common information any part of the extension might be interested in accessing

import * as vscode from "vscode";
import { RecentFiles } from "./RecentFiles";
import { getWorkspaceFolderByName } from "./utils/workspace";
import { getConfig } from "./config/config";
import { isJackedIn } from "./tools/opengoal/nrepl/opengoal-nrepl";
import { getLspStatus } from "./lsp/main";

const channel = vscode.window.createOutputChannel("OpenGOAL");
let extensionContext: vscode.ExtensionContext;
let recentFiles: RecentFiles;
let projectRoot: vscode.Uri | undefined = undefined;
let extensionStatus: vscode.StatusBarItem;

export function initContext(extContext: vscode.ExtensionContext) {
  extensionContext = extContext;
  extensionStatus = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0,
  );
  updateStatusBar(false, false);

  recentFiles = new RecentFiles(extensionContext);
  if (vscode.window.activeTextEditor?.document != undefined) {
    recentFiles.addFile(vscode.window.activeTextEditor?.document.fileName);
  }

  // Commands
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand("opengoal.openLogs", () => {
      channel.show();
    }),
  );
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
        "OpenGOAL - Unable to locate 'jak-project' workspace folder",
      );
      throw new Error("unable to locate 'jak-project' workspace folder");
    }
  }
  return projectRoot;
}

export function updateStatusBar(
  workInProgress: boolean,
  errorOccurred: boolean,
  text?: string,
): void {
  let statusIcon = "";
  const statusItem = extensionStatus;
  statusItem.show();
  statusItem.tooltip = new vscode.MarkdownString("", true);
  statusItem.tooltip.isTrusted = true;
  if (errorOccurred) {
    statusIcon = "$(testing-error-icon) ";
  } else if (workInProgress) {
    statusIcon = "$(loading~spin) ";
  }
  if (errorOccurred) {
    statusItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorForeground",
    );
  } else {
    statusItem.backgroundColor = undefined;
  }
  statusItem.command = "opengoal.openLogs";
  if (text) {
    statusItem.text = `${statusIcon}${text}`;
  } else {
    statusItem.text = `${statusIcon}OpenGOAL`;
  }
  // tooltip
  statusItem.tooltip.appendMarkdown("**General**");
  statusItem.tooltip.appendMarkdown("\n\n---\n\n");
  statusItem.tooltip.appendMarkdown(
    `\n\n[Open Extension Logs](command:opengoal.openLogs)`,
  );
  if (isJackedIn()) {
    statusItem.tooltip.appendMarkdown(
      `\n\n[nREPL Un-jack](command:opengoal.nrepl.unjack)`,
    );
  } else {
    statusItem.tooltip.appendMarkdown(
      `\n\n[nREPL Jack-in](command:opengoal.nrepl.jackin)`,
    );
  }
  statusItem.tooltip.appendMarkdown(
    `\n\n[Change Parinfer Mode](command:opengoal.parinfer.changeMode): ${
      getConfig().opengoalParinferMode
    }`,
  );
  statusItem.tooltip.appendMarkdown("\n\n**LSP**");
  statusItem.tooltip.appendMarkdown("\n\n---\n\n");
  if (getLspStatus() === "started" || getLspStatus() === "error") {
    statusItem.tooltip.appendMarkdown(
      `\n\n[Restart Server](command:opengoal.lsp.restart)`,
    );
  } else if (getLspStatus() === "stopped") {
    statusItem.tooltip.appendMarkdown(
      `\n\n[Start Server](command:opengoal.lsp.start)`,
    );
  }
  if (
    getLspStatus() !== "stopped" &&
    getLspStatus() !== "downloading" &&
    getLspStatus() !== "error"
  ) {
    statusItem.tooltip.appendMarkdown(
      `\n\n[Stop Server](command:opengoal.lsp.stop)`,
    );
  }

  if (getConfig().opengoalLspLogPath !== undefined) {
    statusItem.tooltip.appendMarkdown(
      `\n\n[Open LSP Logs](command:opengoal.lsp.openLogs)`,
    );
  }
  statusItem.tooltip.appendMarkdown("\n\n**Decompiling**");
  statusItem.tooltip.appendMarkdown("\n\n---\n\n");
  statusItem.tooltip.appendMarkdown(
    `\n\n[Open Decompiler Logs](command:opengoal.decomp.openLogs)`,
  );
  statusItem.tooltip.appendMarkdown(
    `\n\n[${
      getConfig().autoDecompilation ? "Disable" : "Enable"
    } Auto-Decompilation](command:opengoal.decomp.toggleAutoDecompilation)`,
  );
}
