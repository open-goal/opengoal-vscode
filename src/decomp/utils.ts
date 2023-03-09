import { parse, stringify } from "comment-json";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as vscode from "vscode";
import { getConfig } from "../config/config";
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
  let castFilePath = "";
  if (gameName == GameName.Jak1) {
    castFilePath = vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak1/${config.jak2DecompConfigVersion}/${fileName}`
    ).fsPath;
  } else if (gameName == GameName.Jak2) {
    castFilePath = vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak2/${config.jak2DecompConfigVersion}/${fileName}`
    ).fsPath;
  }
  if (!existsSync(castFilePath)) {
    return undefined;
  }

  return parse(readFileSync(castFilePath).toString(), undefined, true);
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

export function getDecompilerConfigDirectory(
  activeFile: vscode.Uri
): string | undefined {
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder"
    );
    return undefined;
  }

  const gameName = determineGameFromPath(activeFile);
  let decompConfigPath = undefined;
  if (gameName == GameName.Jak1) {
    decompConfigPath = vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak1/`
    ).fsPath;
  } else if (gameName == GameName.Jak2) {
    decompConfigPath = vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak2/`
    ).fsPath;
  }
  if (decompConfigPath === undefined || !existsSync(decompConfigPath)) {
    return undefined;
  } else {
    return decompConfigPath;
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
      // Check to see if the name has already been used, the decompiler does not support this
      for (const argName of varNameData[funcName].args) {
        if (argName === newName) {
          vscode.window.showErrorMessage(
            "OpenGOAL - Cannot cast different args to the same name, unsupported!"
          );
          return;
        }
      }

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
      // Check to see if the name has already been used, the decompiler does not support this
      for (const [key, value] of Object.entries(varNameData[funcName].vars)) {
        if (value === newName) {
          vscode.window.showErrorMessage(
            "OpenGOAL - Cannot cast different variables to the same name, unsupported!"
          );
          return;
        }
      }

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
