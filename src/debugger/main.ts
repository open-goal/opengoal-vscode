import * as vscode from "vscode";
import { GoalDebugSession } from "./goal-debug-session";
import { getConfig } from "../config/config";
import { getWorkspaceFolderByName } from "../utils/workspace";
import { determineGameFromPath, GameName } from "../utils/file-utils";

export const GOAL_DEBUG_TYPE = "opengoal";

const DEBUG_PORT_BASE = 8128;

export function debugPortForGame(game: GameName | undefined): number {
  switch (game) {
    case GameName.Jak2:
      return DEBUG_PORT_BASE + 1;
    case GameName.Jak3:
      return DEBUG_PORT_BASE + 2;
    case GameName.JakX:
      return DEBUG_PORT_BASE + 3;
    default:
      return DEBUG_PORT_BASE;
  }
}

class GoalDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(
    _session: vscode.DebugSession,
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new GoalDebugSession());
  }
}

class GoalDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider
{
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    // pressing F5 with no launch.json at all
    if (!config.type && !config.request && !config.name) {
      config.type = GOAL_DEBUG_TYPE;
      config.name = "OpenGOAL: Attach";
      config.request = "attach";
    }

    if (config.projectRoot === undefined) {
      const projectRoot =
        getWorkspaceFolderByName("jak-project") ?? folder?.uri;
      if (projectRoot !== undefined) {
        config.projectRoot = projectRoot.fsPath;
      }
    }

    if (config.port === undefined) {
      const configured = getConfig().debugPort;
      if (configured !== undefined && configured > 0) {
        config.port = configured;
      } else {
        // guess from whichever game the active file belongs to
        const activeFile = vscode.window.activeTextEditor?.document.uri;
        const game = activeFile ? determineGameFromPath(activeFile) : undefined;
        config.port = debugPortForGame(game);
      }
    }

    return config;
  }
}

export function activateDebugger(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      GOAL_DEBUG_TYPE,
      new GoalDebugConfigurationProvider(),
    ),
  );
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      GOAL_DEBUG_TYPE,
      new GoalDebugAdapterFactory(),
    ),
  );
}
