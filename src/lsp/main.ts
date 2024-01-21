import * as vscode from "vscode";
import * as path from "path";
import {
  BaseLanguageClient,
  ClientCapabilities,
  DocumentSelector,
  FeatureState,
  InitializeParams,
  LanguageClient,
  LanguageClientOptions,
  ServerCapabilities,
  ServerOptions,
  StaticFeature,
  TransportKind,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest,
} from "vscode-languageclient/node";
import { getConfig } from "../config/config";
import { downloadLsp } from "./download";
import { getLatestVersion, getLspPath, getVersionFromMetaFile } from "./util";
import * as fs from "fs";
import { disposeAll } from "../vendor/vscode-pdfviewer/disposable";

let extensionContext: vscode.ExtensionContext;
let opengoalLspPath: string | undefined;
let activeClient: LanguageClient | undefined;

type LspStatus =
  | "stopped"
  | "starting"
  | "started"
  | "downloading"
  | "error"
  | "serverProgressBegin"
  | "serverProgressEnd";

// TODO - rust analyzer's context menu on hover is nice
class LSPStatusItem {
  private currentStatus: LspStatus = "stopped";

  constructor(private readonly statusItem: vscode.StatusBarItem) {}

  public updateStatus(status: LspStatus, extraInfo?: string) {
    this.currentStatus = status;
    switch (this.currentStatus) {
      case "stopped":
        this.statusItem.text = "$(circle-outline) OpenGOAL LSP Stopped";
        this.statusItem.tooltip = "Launch LSP";
        this.statusItem.command = "opengoal.lsp.start";
        break;
      case "starting":
        this.statusItem.text = "$(loading~spin) OpenGOAL LSP Starting";
        this.statusItem.tooltip = "LSP Starting";
        this.statusItem.command = undefined;
        break;
      case "started":
        this.statusItem.text = "$(circle-filled) OpenGOAL LSP Ready";
        this.statusItem.tooltip = `LSP Active - ${extraInfo}`;
        this.statusItem.command = "opengoal.lsp.showLspStartedMenu";
        break;
      case "downloading":
        this.statusItem.text = `$(sync~spin) OpenGOAL LSP Downloading - ${extraInfo}`;
        this.statusItem.tooltip = `Downloading version - ${extraInfo}`;
        this.statusItem.command = undefined;
        break;
      case "error":
        this.statusItem.text = "$(error) OpenGOAL LSP Error";
        this.statusItem.tooltip = "LSP not running due to an error";
        this.statusItem.command = undefined;
        break;
      case "serverProgressBegin":
        this.statusItem.text = `$(loading~spin) ${extraInfo}`;
        this.statusItem.tooltip = extraInfo;
        this.statusItem.command = "opengoal.lsp.showLspStartedMenu";
        break;
      case "serverProgressEnd":
        this.statusItem.text = `$(circle-filled) ${extraInfo}`;
        this.statusItem.tooltip = extraInfo;
        this.statusItem.command = "opengoal.lsp.showLspStartedMenu";
        break;
      default:
        break;
    }
  }

  public hide() {
    this.statusItem.hide();
  }

  public show() {
    this.statusItem.show();
  }
}

const statusItem = new LSPStatusItem(
  vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0),
);

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
  statusItem.updateStatus("downloading", versionToDownload);
  const newLspPath = await downloadLsp(
    extensionContext.extensionPath,
    versionToDownload,
  );
  if (newLspPath === undefined) {
    statusItem.updateStatus("error");
  } else {
    statusItem.updateStatus("stopped");
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
  statusItem.updateStatus("stopped");
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

class StatusBarFeature implements StaticFeature {
  private requestHandlers: vscode.Disposable[] = [];
  public fillClientCapabilities(capabilities: ClientCapabilities): void {
    if (!capabilities.window) {
      capabilities.window = {};
    }
    capabilities.window.workDoneProgress = true;
  }

  constructor(private readonly client: BaseLanguageClient) {}

  fillInitializeParams?: ((params: InitializeParams) => void) | undefined;
  preInitialize?:
    | ((
        capabilities: ServerCapabilities<any>,
        documentSelector: DocumentSelector | undefined,
      ) => void)
    | undefined;
  clear(): void {
    throw new Error("Method not implemented.");
  }

  public getState(): FeatureState {
    return { kind: "static" };
  }

  public dispose(): void {
    // nothing to dispose here
  }

  public initialize(): void {
    this.requestHandlers.push(
      this.client.onRequest(WorkDoneProgressCreateRequest.type, ({ token }) => {
        this.client.onProgress(WorkDoneProgress.type, token, (progress) => {
          if (progress.kind === "begin") {
            statusItem.updateStatus("serverProgressBegin", progress.title);
          }
          if (progress.kind === "report") {
            // do nothing right now, goalc provides no feedback on it's status
          }
          if (progress.kind === "end") {
            statusItem.updateStatus("serverProgressEnd", progress.message);
            disposeAll(this.requestHandlers);
          }
        });
      }),
    );
  }
}

async function startClient(): Promise<void> {
  if (opengoalLspPath === undefined) {
    return;
  }
  const client = createClient(opengoalLspPath);
  client.registerFeature(new StatusBarFeature(client));
  console.log("Starting opengoal-lsp at", opengoalLspPath);

  // TODO - some form of startup test would be nice
  try {
    statusItem.updateStatus("starting");
    await client.start();
    activeClient = client;
    statusItem.updateStatus("started", path.basename(opengoalLspPath));
  } catch (error) {
    console.error("opengoal-lsp:", error);
    statusItem.updateStatus("error");
    statusItem.hide();
    await stopClient();
  }
}

export async function startClientCommand() {
  statusItem.show();
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

function registerLifeCycleCommands(context: vscode.ExtensionContext): void {
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
  registerLifeCycleCommands(context);
  // TODO - add info and open log file options
  // registerDiagnosticsCommands(context);
  statusItem.updateStatus("stopped");
  statusItem.show();
  const config = getConfig();
  if (config.launchLspOnStartup) {
    await startClientCommand();
  }
}

export function deactivate(): Promise<void> {
  return stopClient();
}
