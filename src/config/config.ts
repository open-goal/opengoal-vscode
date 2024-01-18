import * as vscode from "vscode";

export function getConfig() {
  const configOptions = vscode.workspace.getConfiguration("opengoal");

  return {
    opengoalParinferMode: configOptions.get<string>("parinferMode"),
    autoReplJackIn: configOptions.get<boolean>("replAutoJackIn"),
    reloadFileOnSave: configOptions.get<boolean>("reloadFileOnSave"),
    launchLspOnStartup: configOptions.get<boolean>("launchLspOnStartup"),
    opengoalLspVersion: configOptions.get<string>("opengoalLspVersion"),
    opengoalLspPath: configOptions.get<string>("opengoalLspPath"),
    opengoalLspLogPath: configOptions.get<string>("opengoalLspLogPath"),
    opengoalLspLogVerbose: configOptions.get<boolean>("opengoalLspLogVerbose"),

    eeManPagePath: configOptions.get<string>("eeManPagePath"),
    vuManPagePath: configOptions.get<string>("vuManPagePath"),
    decompilerPath: configOptions.get<string>("decompilerPath"),
    typeSearcherPath: configOptions.get<string>("typeSearcherPath"),
    jak1DecompConfigVersion: configOptions.get<string>(
      "decompilerJak1ConfigVersion",
      "ntsc_v1",
    ),
    jak2DecompConfigVersion: configOptions.get<string>(
      "decompilerJak2ConfigVersion",
      "ntsc_v1",
    ),
    jak3DecompConfigVersion: configOptions.get<string>(
      "decompilerJak3ConfigVersion",
      "ntsc_v1",
    ),
    colorsGoalGlobals: configOptions.get<string>("colors.goal.entity.global"),
    colorsGoalStorageControl: configOptions.get<string>(
      "colors.goal.storage.control",
    ),
    colorsGoalSymbols: configOptions.get<string>("colors.goal.symbol"),
    colorsIRTypeAnalysis: configOptions.get<string>("colors.ir.typeanalysis"),
    colorsIRError: configOptions.get<string>("colors.ir.error"),
    colorsIRWarning: configOptions.get<string>("colors.ir.warn"),
    colorsIRInfo: configOptions.get<string>("colors.ir.info"),
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
    vscode.ConfigurationTarget.Global,
  );
}

export async function updateVuManPagePath(path: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.vuManPagePath",
    path,
    vscode.ConfigurationTarget.Global,
  );
}

export async function updateDecompilerPath(path: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.decompilerPath",
    path,
    vscode.ConfigurationTarget.Global,
  );
}

export async function updateTypeSearcherPath(path: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.typeSearcherPath",
    path,
    vscode.ConfigurationTarget.Global,
  );
}

export async function updateOpengoalParinferMode(mode: string) {
  const userConfig = vscode.workspace.getConfiguration();
  await userConfig.update(
    "opengoal.parinferMode",
    mode,
    vscode.ConfigurationTarget.Global,
  );
}
