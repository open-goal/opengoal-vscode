import * as vscode from "vscode";
import * as path from "path";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { getConfig } from "../config/config";
import { downloadLsp } from "./download";
import { getLatestVersion, getVersionFromMetaFile } from "./util";

let extensionContext: vscode.ExtensionContext;
let opengoalLspPath: string | undefined;
let activeClient: LanguageClient | undefined;

const lspStatusItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  0
);

export type LspStatus =
  | "stopped"
  | "starting"
  | "started"
  | "downloading"
  | "error";
export let lspStatus: LspStatus = "stopped";

function updateStatus(status: LspStatus, extraInfo?: string) {
  lspStatus = status;
  switch (status) {
    case "stopped":
      lspStatusItem.text = "$(circle-outline) opengoal-lsp";
      lspStatusItem.tooltip = "opengoal-lsp is not active, click to get a menu";
      lspStatusItem.command = "opengoal.lsp.showLspStoppedMenu";
      break;
    case "starting":
      lspStatusItem.text = "$(rocket) opengoal-lsp";
      lspStatusItem.tooltip = "opengoal-lsp is starting";
      lspStatusItem.command = undefined;
      break;
    case "started":
      lspStatusItem.text = "$(circle-filled) opengoal-lsp";
      lspStatusItem.tooltip = "opengoal-lsp is active";
      lspStatusItem.command = "opengoal.lsp.showLspStartedMenu";
      break;
    case "downloading":
      lspStatusItem.text = "$(sync~spin) opengoal-lsp downloading";
      lspStatusItem.tooltip = `OpenGOAL is downloading opengoal-lsp version: ${extraInfo}`;
      lspStatusItem.command = undefined;
      break;
    case "error":
      lspStatusItem.text = "$(error) opengoal-lsp";
      lspStatusItem.tooltip =
        "opengoal-lsp is not running because of some error";
      lspStatusItem.command = "opengoal.lsp.showLspStoppedMenu";
      break;
    default:
      break;
  }
}

async function ensureServerDownloaded(): Promise<string | undefined> {
  const installedVersion = getVersionFromMetaFile(
    extensionContext.extensionPath
  );
  const configuredVersion = getConfig().opengoalLspVersion;

  // See if we have the right version
  // - either its the latest
  // - or we have the one that's configured
  let needDownload = false;
  let versionToDownload = "";
  if (
    configuredVersion !== undefined &&
    configuredVersion !== installedVersion
  ) {
    needDownload = true;
    versionToDownload = configuredVersion;
  } else {
    const latestVersion = await getLatestVersion();
    if (latestVersion !== installedVersion) {
      needDownload = true;
      versionToDownload = latestVersion;
    }
  }

  if (!needDownload) {
    return;
  }

  // Install the LSP and update the version metadata file
  updateStatus("downloading", versionToDownload);
  const newLspPath = await downloadLsp(
    extensionContext.extensionPath,
    versionToDownload
  );
  if (newLspPath === undefined) {
    updateStatus("error");
  } else {
    updateStatus("stopped");
  }
  return newLspPath;
}

async function maybeDownloadLspServer(): Promise<void> {
  const userConfiguredOpengoalLspPath = getConfig().opengoalLspPath;
  if (
    userConfiguredOpengoalLspPath !== "" &&
    userConfiguredOpengoalLspPath !== undefined
  ) {
    opengoalLspPath = userConfiguredOpengoalLspPath;
  } else {
    opengoalLspPath = await ensureServerDownloaded();
  }
}

function createClient(lspPath: string): LanguageClient {
  const serverOptions: ServerOptions = {
    run: {
      command: lspPath,
      transport: TransportKind.stdio,
      args: ["--log", path.join(extensionContext.extensionPath, "lsp.log")],
    },
    debug: {
      command: lspPath,
      transport: TransportKind.stdio,
      args: [
        "--verbose",
        "--log",
        path.join(extensionContext.extensionPath, "lsp.log"),
      ],
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "opengoal-ir" },
      { scheme: "file", language: "opengoal" },
    ],
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher("**/*_ir2.asm"),
        vscode.workspace.createFileSystemWatcher("**/all-types.gc"),
      ],
    },
    progressOnInitialization: true,
    initializationOptions: {
      "dependency-scheme": "jar",
      "auto-add-ns-to-new-files?": true,
      "document-formatting?": false,
      "document-range-formatting?": false,
      "keep-require-at-start?": true,
    },
    middleware: {
      async provideHover(document, position, token, next) {
        return next(document, position, token);
      },
    },
  };
  return new LanguageClient(
    "opengoal-lsp",
    "OpenGOAL LSP",
    serverOptions,
    clientOptions
  );
}

async function stopClient() {
  updateStatus("stopped");
  if (activeClient !== undefined) {
    console.log("Stopping opengoal-lsp");
    return await activeClient
      .stop()
      .then(() => {
        activeClient = undefined;
      })
      .catch((e: any) => {
        console.error("Stopping client error:", e);
      });
  }
}

async function startClient(): Promise<void> {
  if (opengoalLspPath === undefined) {
    return;
  }
  const client = createClient(opengoalLspPath);
  console.log("Starting opengoal-lsp at", opengoalLspPath);

  // TODO - some form of startup test would be nice
  try {
    updateStatus("starting");
    await client.start();
    activeClient = client;
    updateStatus("started");
  } catch (error) {
    console.error("opengoal-lsp:", error);
    updateStatus("error");
    lspStatusItem.hide();
    await stopClient();
  }
}

export async function startClientCommand() {
  lspStatusItem.show();
  await maybeDownloadLspServer();
  if (opengoalLspPath !== undefined) {
    await startClient();
  }
}

async function restartClient() {
  await stopClient();
  await startClientCommand();
}

function showMenu(
  items: vscode.QuickPickItem[],
  commands: Record<string, string>
) {
  void vscode.window
    .showQuickPick(items, { title: "clojure-lsp" })
    .then((v) => {
      if (v !== undefined && commands[v.label]) {
        void vscode.commands.executeCommand(commands[v.label]);
      }
    });
}

function stoppedMenuCommand() {
  const START_OPTION = "Start";
  const START_COMMAND = "opengoal.lsp.start";
  const commands: any = {};
  commands[START_OPTION] = START_COMMAND;
  const items: vscode.QuickPickItem[] = [
    {
      label: START_OPTION,
      description: "Start the clojure-lsp server",
    },
  ];
  showMenu(items, commands);
}

function startedMenuCommand() {
  const STOP_OPTION = "Stop";
  const STOP_COMMAND = "opengoal.lsp.stop";
  const RESTART_OPTION = "Restart";
  const RESTART_COMMAND = "opengoal.lsp.restart";
  // TODO - add info and open log file options
  const commands = {
    [STOP_OPTION]: STOP_COMMAND,
    [RESTART_OPTION]: RESTART_COMMAND,
  };
  const items: vscode.QuickPickItem[] = [
    {
      label: STOP_OPTION,
      description: "Stop the clojure-lsp server",
    },
    {
      label: RESTART_OPTION,
      description: "Restart the clojure-lsp server",
    },
  ];
  showMenu(items, commands);
}

function registerLifeCycleCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.lsp.start", startClientCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.lsp.stop", stopClient)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.lsp.restart", restartClient)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.lsp.showLspStoppedMenu",
      stoppedMenuCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.lsp.showLspStartedMenu",
      startedMenuCommand
    )
  );
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  extensionContext = context;
  registerLifeCycleCommands(context);
  // TODO - add info and open log file options
  // registerDiagnosticsCommands(context);
  updateStatus("stopped");
  lspStatusItem.show();
  await startClientCommand();
}

export function deactivate(): Promise<void> {
  return stopClient();
}
