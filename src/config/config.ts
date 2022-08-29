import * as vscode from "vscode";

export function getConfig() {
  const configOptions = vscode.workspace.getConfiguration("opengoal");

  return {
    launchLspOnStartup: configOptions.get<boolean>("launchLspOnStartup"),
    opengoalLspVersion: configOptions.get<string>("opengoalLspVersion"),
    opengoalLspPath: configOptions.get<string>("opengoalLspPath"),
    eeManPagePath: configOptions.get<string>("eeManPagePath"),
    vuManPagePath: configOptions.get<string>("vuManPagePath"),
    decompilerPath: configOptions.get<string>("decompilerPath"),
    jak1DecompConfig: configOptions.get<string>("decompilerJak1Config"),
    jak2DecompConfig: configOptions.get<string>("decompilerJak2Config"),
    decompilerJak1ConfigDirectory: configOptions.get<string>(
      "decompilerJak1ConfigDirectory"
    ),
    decompilerJak2ConfigDirectory: configOptions.get<string>(
      "decompilerJak2ConfigDirectory"
    ),
    colorsGoalGlobals: configOptions.get<string>("colors.goal.entity.global"),
    colorsGoalStorageControl: configOptions.get<string>(
      "colors.goal.storage.control"
    ),
    colorsGoalSymbols: configOptions.get<string>("colors.goal.symbol"),
    colorsIRTypeAnalysis: configOptions.get<string>("colors.ir.typeanalysis"),
    colorsIRError: configOptions.get<string>("colors.ir.error"),
    colorsIRWarning: configOptions.get<string>("colors.ir.warn"),
    colorsIROpNumber: configOptions.get<string>("colors.ir.opnumber"),
    colorsIRRegA0: configOptions.get<string>("colors.ir.reg.a0"),
    colorsIRRegA1: configOptions.get<string>("colors.ir.reg.a1"),
    colorsIRRegA2: configOptions.get<string>("colors.ir.reg.a2"),
    colorsIRRegA3: configOptions.get<string>("colors.ir.reg.a3"),
    colorsIRRegT0: configOptions.get<string>("colors.ir.reg.t0"),
    colorsIRRegT1: configOptions.get<string>("colors.ir.reg.t1"),
    colorsIRRegT2: configOptions.get<string>("colors.ir.reg.t2"),
    colorsIRRegT3: configOptions.get<string>("colors.ir.reg.t3"),
    colorsIRRegFloat: configOptions.get<string>("colors.ir.reg.float"),
    colorsIRRegReturn: configOptions.get<string>("colors.ir.reg.return"),
    colorsIRRegStack: configOptions.get<string>("colors.ir.reg.stack"),
    colorsIRRegProcess: configOptions.get<string>("colors.ir.reg.process"),
    colorsIRRegGeneral: configOptions.get<string>("colors.ir.reg.general"),
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

export async function updateJak1DecompConfigDirectory(dir: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.decompilerJak1ConfigDirectory",
    dir,
    vscode.ConfigurationTarget.Global
  );
}

export async function updateJak2DecompConfigDirectory(dir: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.decompilerJak2ConfigDirectory",
    dir,
    vscode.ConfigurationTarget.Global
  );
}
