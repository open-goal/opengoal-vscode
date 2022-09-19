import { parse, stringify } from "comment-json";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as vscode from "vscode";
import {
  getConfig,
  updateJak1DecompConfigDirectory,
  updateJak2DecompConfigDirectory,
} from "../config/config";
import { ArgumentMeta } from "../languages/opengoal/opengoal-tools";
import {
  determineGameFromPath,
  GameName,
  getDirectoriesInDir,
} from "../utils/file-utils";
import { getWorkspaceFolderByName } from "../utils/workspace";

export function getCastFileData(
  projectRoot: vscode.Uri,
  document: vscode.TextDocument,
  fileName: string
): any | undefined {
  const gameName = determineGameFromPath(document.uri);
  if (gameName === undefined) {
    return undefined;
  }
  const config = getConfig();
  let decompConfigPath = "";
  if (gameName == GameName.Jak1) {
    const path = config.decompilerJak1ConfigDirectory;
    if (path === undefined) {
      return undefined;
    }
    decompConfigPath = path;
  } else if (gameName == GameName.Jak2) {
    const path = config.decompilerJak2ConfigDirectory;
    if (path === undefined) {
      return undefined;
    }
    decompConfigPath = path;
  }
  const path = vscode.Uri.joinPath(
    projectRoot,
    `decompiler/config/${decompConfigPath}/${fileName}`
  ).fsPath;
  if (!existsSync(path)) {
    return undefined;
  }

  return parse(readFileSync(path).toString(), undefined, true);
}

async function promptUserToSelectConfigDirectory(
  projectRoot: vscode.Uri
): Promise<string | undefined> {
  // Get all `.jsonc` files in ./decompiler/config
  const dirs = await getDirectoriesInDir(
    vscode.Uri.joinPath(projectRoot, "decompiler/config").fsPath
  );
  return await vscode.window.showQuickPick(dirs, {
    title: "Config?",
  });
}

export async function getDecompilerConfigDirectory(
  activeFile: vscode.Uri
): Promise<string | undefined> {
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder"
    );
    return undefined;
  }

  const config = getConfig();
  const gameName = determineGameFromPath(activeFile);
  if (gameName == GameName.Jak1) {
    if (
      config.decompilerJak1ConfigDirectory === undefined ||
      !existsSync(
        vscode.Uri.joinPath(
          projectRoot,
          "decompiler/config/",
          config.decompilerJak1ConfigDirectory
        ).fsPath
      )
    ) {
      const selection = await promptUserToSelectConfigDirectory(projectRoot);
      if (selection === undefined) {
        vscode.window.showErrorMessage(
          "OpenGOAL - Can't cast without knowing where to store them!"
        );
        return undefined;
      }
      await updateJak1DecompConfigDirectory(selection);
      return vscode.Uri.joinPath(projectRoot, "decompiler/config/", selection)
        .fsPath;
    } else {
      return vscode.Uri.joinPath(
        projectRoot,
        "decompiler/config/",
        config.decompilerJak1ConfigDirectory
      ).fsPath;
    }
  } else if (gameName == GameName.Jak2) {
    if (
      config.decompilerJak2ConfigDirectory === undefined ||
      !existsSync(
        vscode.Uri.joinPath(
          projectRoot,
          "decompiler/config/",
          config.decompilerJak2ConfigDirectory
        ).fsPath
      )
    ) {
      const selection = await promptUserToSelectConfigDirectory(projectRoot);
      if (selection === undefined) {
        vscode.window.showErrorMessage(
          "OpenGOAL - Can't cast without knowing where to store them!"
        );
        return undefined;
      }
      await updateJak2DecompConfigDirectory(selection);
      return vscode.Uri.joinPath(projectRoot, "decompiler/config/", selection)
        .fsPath;
    } else {
      return vscode.Uri.joinPath(
        projectRoot,
        "decompiler/config/",
        config.decompilerJak2ConfigDirectory
      ).fsPath;
    }
  }
}

export async function updateVarCasts(
  document: vscode.TextDocument,
  funcName: string,
  argMeta: ArgumentMeta | undefined,
  currSymbol: string,
  newName: string
) {
  // Update the var-names file
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder"
    );
    return;
  }

  const varNameData = getCastFileData(projectRoot, document, "var_names.jsonc");
  if (varNameData === undefined) {
    return;
  }

  if (!(funcName in varNameData)) {
    varNameData[funcName] = {};
  }
  if (argMeta) {
    if (argMeta.index === undefined || argMeta.totalCount === undefined) {
      return;
    }
    if ("args" in varNameData[funcName]) {
      // We assume that all slots are filled up already, as this is required
      varNameData[funcName].args[argMeta.index] = newName;
    } else {
      // Otherwise, we initialize it properly
      varNameData[funcName].args = [];
      for (let i = 0; i < argMeta.totalCount; i++) {
        if (i == argMeta.index) {
          varNameData[funcName].args[i] = newName;
        } else {
          if (argMeta.isMethod && i == 0) {
            varNameData[funcName].args[i] = "obj";
          } else {
            varNameData[funcName].args[i] = `arg${i}`;
          }
        }
      }
    }
  } else {
    // if "vars" is in
    if ("vars" in varNameData[funcName]) {
      // Check to see if the current symbol has already been renamed
      let internalVar = undefined;
      for (const [key, value] of Object.entries(varNameData[funcName].vars)) {
        if (value === currSymbol) {
          internalVar = key;
          break;
        }
      }
      if (internalVar !== undefined) {
        varNameData[funcName].vars[internalVar] = newName;
      } else {
        varNameData[funcName].vars[currSymbol] = newName;
      }
    } else {
      varNameData[funcName]["vars"] = {};
      varNameData[funcName]["vars"][currSymbol] = newName;
    }
  }

  // Write out cast file change
  const configDir = await getDecompilerConfigDirectory(document.uri);
  if (configDir === undefined) {
    return;
  }
  const filePath = join(configDir, "var_names.jsonc");

  writeFileSync(filePath, stringify(varNameData, null, 2));
}
