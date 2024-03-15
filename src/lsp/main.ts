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
import { getLatestVersion, getLspPath, getVersionFromMetaFile } from "./util";
import * as fs from "fs";
import { updateStatusBar } from "../context";

let extensionContext: vscode.ExtensionContext;
let opengoalLspPath: string | undefined;
let activeClient: LanguageClient | undefined;

export type LspStatus =
  | "stopped"
  | "starting"
  | "started"
  | "downloading"
  | "error";

let currentStatus: LspStatus = "stopped";
function updateStatus(status: LspStatus, extraInfo?: string) {
  currentStatus = status;
  switch (currentStatus) {
    case "starting":
      updateStatusBar(true, false, "LSP Starting");
      break;
    case "downloading":
      updateStatusBar(true, false, `LSP Downloading - ${extraInfo}`);
      break;
    case "error":
      updateStatusBar(false, true, "LSP Startup Error");
      break;
    default:
      updateStatusBar(false, false);
      break;
  }
}

/**
 * Get the current status of the LSP.
 * @returns A string representing the current status of the LSP, one of "stopped", "starting", "started", "downloading", or "error".
 */
export function getLspStatus(): LspStatus {
  return currentStatus;
}

async function ensureServerDownloaded(): Promise<string | undefined> {
  const installedVersion = getVersionFromMetaFile(
    extensionContext.extensionPath,
  );
  const configuredVersion = getConfig().opengoalLspVersion;

  // See if we have the right version
  // - either its the latest
  // - or we have the one that's configured
  let versionToDownload = "";
  if (
    configuredVersion !== undefined &&
    configuredVersion !== installedVersion
  ) {
    versionToDownload = configuredVersion;
  } else {
    const latestVersion = await getLatestVersion();
    if (latestVersion !== installedVersion) {
      versionToDownload = latestVersion;
    } else {
      // Check that the file wasn't unexpectedly removed
      const lspPath = getLspPath(
        extensionContext.extensionPath,
        installedVersion,
      );
      if (lspPath === undefined) {
        versionToDownload = latestVersion;
      } else {
        return lspPath;
      }
    }
  }

  // Install the LSP and update the version metadata file
  updateStatus("downloading", versionToDownload);
  const newLspPath = await downloadLsp(
    extensionContext.extensionPath,
    versionToDownload,
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
    // Copy the binary to the extension directory so it doesn't block future compilations
    const lspPath = path.join(
      extensionContext.extensionPath,
      `opengoal-lsp-local.bin`,
    );
    // Check that the LSP is statically linked, we can assume
    // this from the file size (if it's less than 4mb, conservatively it ain't statically linked)
    const stats = fs.statSync(userConfiguredOpengoalLspPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
    if (fileSizeInMegabytes <= 4) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Local LSP path does not appear to point to a statically linked binary",
      );
      return;
    }
    fs.copyFileSync(userConfiguredOpengoalLspPath, lspPath);
    opengoalLspPath = lspPath;
  } else {
    opengoalLspPath = await ensureServerDownloaded();
  }
}

function createClient(lspPath: string): LanguageClient {
  const logPath =
    getConfig().opengoalLspLogPath ??
    path.join(extensionContext.extensionPath, "lsp.log");
  const normalArgs = ["--log", logPath];
  if (getConfig().opengoalLspLogVerbose) {
    normalArgs.push("--verbose");
  }
  const serverOptions: ServerOptions = {
    run: {
      command: lspPath,
      transport: TransportKind.stdio,
      args: normalArgs,
    },
    debug: {
      command: lspPath,
      transport: TransportKind.stdio,
      args: ["--verbose", "--log", logPath],
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "opengoal-ir" },
      { scheme: "file", language: "opengoal" },
    ],
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher("**/*.gc"),
        vscode.workspace.createFileSystemWatcher("**/*_ir2.asm"),
        vscode.workspace.createFileSystemWatcher("**/all-types.gc"),
      ],
    },
    progressOnInitialization: true,
    initializationOptions: {},
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
    clientOptions,
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
    updateStatus("started", path.basename(opengoalLspPath));
  } catch (error) {
    console.error("opengoal-lsp:", error);
    updateStatus("error");
    await stopClient();
  }
}

export async function startClientCommand() {
  await maybeDownloadLspServer();
  if (opengoalLspPath !== undefined) {
    await startClient();
  }
}

async function restartClient() {
  console.log("Stopping opengoal-lsp - restart");
  await stopClient();
  await new Promise((f) => setTimeout(f, 2000));
  console.log("Starting opengoal-lsp - restart");
  await startClientCommand();
}

function showMenu(
  items: vscode.QuickPickItem[],
  commands: Record<string, string>,
) {
  void vscode.window
    .showQuickPick(items, { title: "OpenGOAL LSP" })
    .then((v) => {
      if (v !== undefined && commands[v.label]) {
        void vscode.commands.executeCommand(commands[v.label]);
      }
    });
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
      description: "Stop the OpenGOAL LSP",
    },
    {
      label: RESTART_OPTION,
      description: "Restart the OpenGOAL LSP",
    },
  ];
  showMenu(items, commands);
}

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.lsp.openLogs", () => {
      const logPath = getConfig().opengoalLspLogPath;
      if (logPath !== undefined) {
        vscode.commands.executeCommand("vscode.open", vscode.Uri.file(logPath));
      }
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.lsp.start", startClientCommand),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.lsp.stop", stopClient),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.lsp.restart", restartClient),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.lsp.showLspStartedMenu",
      startedMenuCommand,
    ),
  );
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  extensionContext = context;
  registerCommands(context);
  const config = getConfig();
  if (config.launchLspOnStartup) {
    await startClientCommand();
  }
}

export function deactivate(): Promise<void> {
  return stopClient();
}
