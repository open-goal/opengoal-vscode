import { parse } from "comment-json";
import { existsSync, readFileSync } from "fs";
import * as vscode from "vscode";
import {
  getConfig,
  updateJak1DecompConfigDirectory,
  updateJak2DecompConfigDirectory,
} from "../config/config";
import {
  determineGameFromPath,
  GameName,
  getDirectoriesInDir,
} from "./file-utils";
import { getWorkspaceFolderByName } from "./workspace";

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

  // TODO - would be performant to cache these files, requires listening to them as well though
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
