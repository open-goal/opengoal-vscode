import * as vscode from "vscode";

export function getConfig() {
  const configOptions = vscode.workspace.getConfiguration("opengoal");

  return {
    opengoalLspVersion: configOptions.get<string>("opengoalLspVersion"),
    opengoalLspPath: configOptions.get<string>("opengoalLspPath"),
    eeManPagePath: configOptions.get<string>("eeManPagePath"),
    vuManPagePath: configOptions.get<string>("vuManPagePath"),
    decompilerPath: configOptions.get<string>("decompilerPath"),
    jak1DecompConfig: configOptions.get<string>("decompilerJak1Config"),
    jak2DecompConfig: configOptions.get<string>("decompilerJak2Config"),
  };
}

export async function updateEeManPagePath(path: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.eeManPagePath",
    path,
    vscode.ConfigurationTarget.Global
  );
}

export async function updateVuManPagePath(path: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.vuManPagePath",
    path,
    vscode.ConfigurationTarget.Global
  );
}

export async function updateDecompilerPath(path: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.decompilerPath",
    path,
    vscode.ConfigurationTarget.Global
  );
}

export async function updateJak1DecompConfig(config: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.decompilerJak1Config",
    config,
    vscode.ConfigurationTarget.Global
  );
}

export async function updateJak2DecompConfig(config: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.decompilerJak2Config",
    config,
    vscode.ConfigurationTarget.Global
  );
}
