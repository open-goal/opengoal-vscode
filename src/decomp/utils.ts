import { parse, stringify } from "comment-json";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as vscode from "vscode";
import { getConfig } from "../config/config";
import { ArgumentMeta } from "../languages/opengoal/opengoal-tools";
import { determineGameFromPath, GameName } from "../utils/file-utils";
import { getWorkspaceFolderByName } from "../utils/workspace";

export function getCastFilePathForGame(
  projectRoot: vscode.Uri,
  gameName: GameName,
  fileName: string,
): string {
  const config = getConfig();
  if (gameName == GameName.Jak1) {
    return vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak1/${config.jak1DecompConfigVersion}/${fileName}`,
    ).fsPath;
  } else if (gameName == GameName.Jak2) {
    return vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak2/${config.jak2DecompConfigVersion}/${fileName}`,
    ).fsPath;
  } else {
    return vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak3/${config.jak3DecompConfigVersion}/${fileName}`,
    ).fsPath;
  }
}

export function getCastFileData(
  projectRoot: vscode.Uri,
  document: vscode.TextDocument,
  fileName: string,
): any | undefined {
  const gameName = determineGameFromPath(document.uri);
  if (gameName === undefined) {
    return undefined;
  }
  const castFilePath = getCastFilePathForGame(projectRoot, gameName, fileName);
  if (!existsSync(castFilePath)) {
    return undefined;
  }

  return parse(readFileSync(castFilePath).toString(), undefined, true);
}

export function getCastFileDataForGame(
  projectRoot: vscode.Uri,
  gameName: GameName,
  fileName: string,
): any | undefined {
  const castFilePath = getCastFilePathForGame(projectRoot, gameName, fileName);
  if (!existsSync(castFilePath)) {
    return undefined;
  }

  return parse(readFileSync(castFilePath).toString(), undefined, true);
}

export function getDecompilerConfigDirectory(
  activeFile: vscode.Uri,
): string | undefined {
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder",
    );
    return undefined;
  }

  const gameName = determineGameFromPath(activeFile);
  let decompConfigPath = undefined;
  if (gameName == GameName.Jak1) {
    decompConfigPath = vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak1/`,
      getConfig().jak1DecompConfigVersion,
    ).fsPath;
  } else if (gameName == GameName.Jak2) {
    decompConfigPath = vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak2/`,
      getConfig().jak2DecompConfigVersion,
    ).fsPath;
  } else if (gameName == GameName.Jak3) {
    decompConfigPath = vscode.Uri.joinPath(
      projectRoot,
      `decompiler/config/jak3/`,
      getConfig().jak3DecompConfigVersion,
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
  newName: string,
) {
  // If the user provides a name with a space and an extra word, interpret that as the variable type
  let varType = undefined;
  if (newName.split(" ").length == 2) {
    varType = newName.split(" ")[1];
    newName = newName.split(" ")[0];
  }

  // Update the var-names file
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder",
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
            "OpenGOAL - Cannot cast different args to the same name, unsupported!",
          );
          return;
        }
      }

      // We assume that all slots are filled up already, as this is required
      if (varType !== undefined) {
        varNameData[funcName].args[argMeta.index] = [newName, varType];
      } else {
        varNameData[funcName].args[argMeta.index] = newName;
      }
    } else {
      // Otherwise, we initialize it properly
      varNameData[funcName].args = [];
      for (let i = 0; i < argMeta.totalCount; i++) {
        if (i == argMeta.index) {
          if (varType !== undefined) {
            varNameData[funcName].args[i] = [newName, varType];
          } else {
            varNameData[funcName].args[i] = newName;
          }
        } else {
          if (argMeta.isMethod && i == 0) {
            varNameData[funcName].args[i] = "this";
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
        if (
          (Array.isArray(value) && value.length == 2 && value[0] === newName) ||
          ((typeof value === "string" || value instanceof String) &&
            value === newName)
        ) {
          vscode.window.showErrorMessage(
            "OpenGOAL - Cannot cast different variables to the same name, unsupported!",
          );
          return;
        }
      }

      // Check to see if the current symbol has already been renamed
      let internalVar = undefined;
      for (const [key, value] of Object.entries(varNameData[funcName].vars)) {
        if (
          (Array.isArray(value) &&
            value.length == 2 &&
            value[0] === currSymbol) ||
          ((typeof value === "string" || value instanceof String) &&
            value === currSymbol)
        ) {
          internalVar = key;
          break;
        }
      }

      if (internalVar !== undefined) {
        if (varType !== undefined) {
          varNameData[funcName].vars[internalVar] = [newName, varType];
        } else {
          varNameData[funcName].vars[internalVar] = newName;
        }
      } else {
        if (varType !== undefined) {
          varNameData[funcName].vars[currSymbol] = [newName, varType];
        } else {
          varNameData[funcName].vars[currSymbol] = newName;
        }
      }
    } else {
      varNameData[funcName]["vars"] = {};
      if (varType !== undefined) {
        varNameData[funcName]["vars"][currSymbol] = [newName, varType];
      } else {
        varNameData[funcName]["vars"][currSymbol] = newName;
      }
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

export async function bulkUpdateVarCasts(
  document: vscode.TextDocument,
  funcName: string,
  argMeta: ArgumentMeta,
  renameMap: Record<string, string>,
) {
  // Update the var-names file
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder",
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

  for (const [oldName, newName] of Object.entries(renameMap)) {
    if (oldName.startsWith("arg")) {
      // initialize if not already done
      if (!("args" in varNameData[funcName])) {
        varNameData[funcName].args = [];
        for (let i = 0; i < argMeta.totalCount; i++) {
          if (argMeta.isMethod && i == 0) {
            varNameData[funcName].args[i] = "this";
          } else {
            varNameData[funcName].args[i] = `arg${i}`;
          }
        }
      }
      let argIndex = parseInt(oldName.substring(3));
      if (argMeta.isMethod) {
        argIndex++;
      }
      varNameData[funcName].args[argIndex] = newName;
    } else {
      if (!("vars" in varNameData[funcName])) {
        varNameData[funcName].vars = {};
      }
      // NOTE - omitting check for duplicate names, just know what you're doing
      varNameData[funcName].vars[oldName] = newName;
    }
  }

  // Write out cast file change
  const configDir = getDecompilerConfigDirectory(document.uri);
  if (configDir === undefined) {
    return;
  }
  const filePath = join(configDir, "var_names.jsonc");

  writeFileSync(filePath, stringify(varNameData, null, 2));
}

export async function copyVarCastsFromOneGameToAnother(
  document: vscode.TextDocument,
  oldGame: GameName,
  newGame: GameName,
  funcName: string,
) {
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder",
    );
    return;
  }

  const oldVarNameData = getCastFileDataForGame(
    projectRoot,
    oldGame,
    "var_names.jsonc",
  );
  if (oldVarNameData === undefined) {
    return;
  }
  const newVarNameData = getCastFileDataForGame(
    projectRoot,
    newGame,
    "var_names.jsonc",
  );
  if (newVarNameData === undefined) {
    return;
  }

  if (!(funcName in oldVarNameData)) {
    return;
  }
  newVarNameData[funcName] = oldVarNameData[funcName];
  // Write out cast file change
  const configDir = getDecompilerConfigDirectory(document.uri);
  if (configDir === undefined) {
    return;
  }
  const filePath = join(configDir, "var_names.jsonc");

  writeFileSync(filePath, stringify(newVarNameData, null, 2));
}
