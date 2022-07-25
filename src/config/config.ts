import * as vscode from "vscode";

export function getConfig() {
  const configOptions = vscode.workspace.getConfiguration("opengoal");

  return {
    opengoalLspVersion: configOptions.get<string>("opengoalLspVersion"),
    opengoalLspPath: configOptions.get<string>("opengoalLspPath"),
  };
}
