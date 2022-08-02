import * as vscode from "vscode";

export class RecentFiles {
  recentFiles: Array<string> = [];
  workspaceState: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this.workspaceState = context.workspaceState;
    this.recentFiles = this.workspaceState.get("recents", []);

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document != undefined) {
          this.addFile(editor?.document.fileName);
        }
      })
    );
  }

  addFile(filePath: string) {
    // dont add duplicates
    // if it exists, take it out and put it on the top
    const idx = this.indexOf(filePath);
    if (idx !== -1) {
      this.recentFiles.splice(idx, 1);
    }
    this.recentFiles.unshift(filePath);
    if (this.recentFiles.length >= 100) {
      this.recentFiles.slice(0, 100);
    }
  }

  includes(filePath: string) {
    return this.recentFiles.find((str) => str === filePath);
  }

  indexOf(filePath: string) {
    return this.recentFiles.findIndex((str) => str === filePath);
  }

  searchByPrefix(text: string) {
    return this.recentFiles.find((str) => str.endsWith(text));
  }
}
