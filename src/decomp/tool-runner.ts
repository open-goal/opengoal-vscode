import { ChildProcess, spawn } from "child_process";
import { existsSync } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getExtensionContext, getProjectRoot } from "../context";
import { determineGameFromPath, GameName } from "../utils/file-utils";

let toolChannel: vscode.OutputChannel | undefined = undefined;

export function getToolChannel(): vscode.OutputChannel {
  if (toolChannel === undefined) {
    toolChannel = vscode.window.createOutputChannel("OpenGOAL Tools");
    getExtensionContext().subscriptions.push(toolChannel);
  }
  return toolChannel;
}

function reportToolError(what: string, error: any) {
  getToolChannel().appendLine(`${what}: ${error?.stack ?? error}`);
  vscode.window.showErrorMessage(`OpenGOAL - ${what}: ${error}`);
}

// routes a tool webview's messages by `command`, reporting anything that goes wrong on either side
// instead of letting it vanish.
export function handleToolMessages(
  panel: vscode.WebviewPanel,
  handlers: Record<string, (message: any) => Promise<void> | void>,
) {
  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === "webviewError") {
        reportToolError(`${panel.title} webview error`, message.error);
        return;
      }
      try {
        await handlers[message.command]?.(message);
      } catch (error: any) {
        reportToolError(`${panel.title} failed`, error);
      }
    },
    undefined,
    getExtensionContext().subscriptions,
  );
}

export interface IR2EditorContext {
  game?: GameName;
  object?: string;
  functionName?: string;
}

// what the active editor says about where the user is, if it's an IR2 file
export function getIR2EditorContext(): IR2EditorContext {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return {};
  }
  const fileName = path.basename(editor.document.fileName);
  if (!fileName.endsWith("_ir2.asm")) {
    return {};
  }
  const context: IR2EditorContext = {
    game: determineGameFromPath(editor.document.uri),
    object: fileName.slice(0, -"_ir2.asm".length),
  };
  for (let i = editor.selection.active.line; i >= 0; i--) {
    const match = editor.document.lineAt(i).text.match(/^; \.function (.*)$/);
    if (match) {
      context.functionName = match[1].trim();
      break;
    }
  }
  return context;
}

export async function resolveToolPath(
  configuredPath: string | undefined,
  binaryName: string,
  updatePath: (path: string) => Promise<void>,
): Promise<string | undefined> {
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const defaultPath = vscode.Uri.joinPath(
    getProjectRoot(),
    process.platform == "win32"
      ? `out/build/Release/bin/${binaryName}.exe`
      : `build/tools/${binaryName}`,
  ).fsPath;
  let toolPath = defaultPath;
  if (!existsSync(defaultPath)) {
    const selection = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: `Select ${binaryName}`,
      title: `Provide the ${binaryName} executable's path`,
    });
    if (selection === undefined || selection.length == 0) {
      vscode.window.showErrorMessage(
        `OpenGOAL - Unable to locate the '${binaryName}' binary`,
      );
      return undefined;
    }
    toolPath = selection[0].fsPath;
  }
  await updatePath(toolPath);
  return toolPath;
}

// a spot in a function, as the search tools report it
export interface IR2Location {
  object: string;
  function: string;
  op: number;
  label: string;
}

// the location's line in the IR2 file: its atomic op if it has one, otherwise counted in
// instructions from the closest label.
function findLocationLine(
  lines: string[],
  loc: IR2Location,
): number | undefined {
  const funcStart = lines.findIndex(
    (line) => line.trimEnd() === `; .function ${loc.function}`,
  );
  if (funcStart === -1) {
    return undefined;
  }
  let funcEnd = lines.findIndex(
    (line, idx) => idx > funcStart && line.startsWith("; .function "),
  );
  if (funcEnd === -1) {
    funcEnd = lines.length;
  }

  if (loc.op >= 0) {
    const opPattern = new RegExp(`;; \\[\\s*${loc.op}\\]`);
    for (let i = funcStart; i < funcEnd; i++) {
      if (opPattern.test(lines[i])) {
        return i;
      }
    }
  }

  const [labelName, offsetStr] = loc.label.split("+");
  if (labelName !== "") {
    let remaining = offsetStr === undefined ? 0 : parseInt(offsetStr);
    const labelLine = lines.findIndex(
      (line, idx) =>
        idx > funcStart && idx < funcEnd && line.startsWith(`${labelName}:`),
    );
    if (labelLine !== -1) {
      for (let i = labelLine + 1; i < funcEnd; i++) {
        const trimmed = lines[i].trim();
        if (
          trimmed === "" ||
          trimmed.startsWith(";") ||
          /^L\d+:/.test(trimmed)
        ) {
          continue;
        }
        if (remaining == 0) {
          return i;
        }
        remaining--;
      }
    }
  }
  return funcStart;
}

export async function openIR2Location(gameName: string, loc: IR2Location) {
  const filePath = vscode.Uri.joinPath(
    getProjectRoot(),
    "decompiler_out",
    gameName,
    `${loc.object}_ir2.asm`,
  );
  if (!existsSync(filePath.fsPath)) {
    vscode.window.showErrorMessage(
      `OpenGOAL - '${loc.object}_ir2.asm' doesn't exist, decompile '${loc.object}' first`,
    );
    return;
  }
  const document = await vscode.workspace.openTextDocument(filePath);
  const line = findLocationLine(document.getText().split(/\r?\n/), loc);
  const position = new vscode.Position(line ?? 0, 0);
  await vscode.window.showTextDocument(document, {
    viewColumn: vscode.ViewColumn.Beside,
    selection: new vscode.Range(position, position),
  });
}

// runs a tool from the project root, streaming its output. the tools fork worker processes, so
// on posix the tool gets its own process group and cancelling kills the whole group.
export class ToolProcess {
  private proc: ChildProcess | undefined;

  get running(): boolean {
    return this.proc !== undefined;
  }

  run(
    binaryPath: string,
    args: string[],
    onOutput: (text: string) => void,
  ): Promise<number | null> {
    const channel = getToolChannel();
    channel.appendLine(`> ${binaryPath} ${args.join(" ")}`);
    const output = (text: string) => {
      channel.append(text);
      onOutput(text);
    };
    return new Promise((resolve) => {
      const proc = spawn(binaryPath, args, {
        cwd: getProjectRoot().fsPath,
        detached: process.platform != "win32",
      });
      this.proc = proc;
      proc.stdout?.setEncoding("utf8");
      proc.stderr?.setEncoding("utf8");
      proc.stdout?.on("data", output);
      proc.stderr?.on("data", output);
      proc.on("error", (err) => {
        output(`\nFailed to run ${binaryPath}: ${err.message}\n`);
      });
      proc.on("close", (code) => {
        channel.appendLine(`\n[exited with ${code ?? "signal"}]`);
        this.proc = undefined;
        resolve(code);
      });
    });
  }

  cancel() {
    const proc = this.proc;
    if (proc === undefined || proc.pid === undefined) {
      return;
    }
    if (process.platform == "win32") {
      proc.kill();
      return;
    }
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      proc.kill();
    }
  }
}

export function toolWebviewHead(title: string, extraStyle = ""): string {
  return `<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/milligram/1.4.1/milligram.min.css">
    <link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.0.0-beta.83/dist/themes/dark.css" />
    <script type="module"
      src="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.0.0-beta.83/dist/shoelace.js"></script>
    <style>
      .wrap { flex-wrap: wrap; }
      .mt-2 { margin-top: 1.5em; }
      .mt-1 { margin-top: 1em; }
      .mr-1 { margin-right: 1em; }
      html { font-size: 0.75em; }
      body { color: var(--sl-color-gray-700); }
      sl-button::part(label) { font-weight: 700; }
      sl-checkbox { display: block; margin-top: 0.5em; }
      h2 { color: var(--sl-color-gray-900); }
      .hidden { display: none !important; }
      #log {
        max-height: 30em;
        overflow: auto;
        white-space: pre;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 1.1em;
        background: var(--sl-color-gray-50);
        border-left: 0.3rem solid var(--sl-color-primary-600);
        padding: 1em;
      }
      #status { margin-left: 1em; }
      table { font-size: 1.1em; }
      td code, pre code { white-space: pre; }
      ${extraStyle}
    </style>
    <script>
      const vscode = acquireVsCodeApi();
      window.addEventListener("error", (evt) => {
        vscode.postMessage({ command: "webviewError", error: evt.message + " (line " + evt.lineno + ")" });
      });
      window.addEventListener("unhandledrejection", (evt) => {
        vscode.postMessage({ command: "webviewError", error: String(evt.reason) });
      });
      let logLines = [""];
      let pendingCR = false;

      function clearLog() {
        logLines = [""];
        pendingCR = false;
        document.getElementById("log").textContent = "";
      }

      function appendLog(text) {
        if (pendingCR) {
          text = "\\r" + text;
          pendingCR = false;
        }
        if (text.endsWith("\\r")) {
          text = text.slice(0, -1);
          pendingCR = true;
        }
        for (const part of text.split(/(\\r\\n|\\r|\\n)/)) {
          if (part === "\\n" || part === "\\r\\n") {
            logLines.push("");
          } else if (part === "\\r") {
            logLines[logLines.length - 1] = "";
          } else {
            logLines[logLines.length - 1] += part;
          }
        }
        const log = document.getElementById("log");
        const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 5;
        log.textContent = logLines.join("\\n");
        if (atBottom) {
          log.scrollTop = log.scrollHeight;
        }
      }

      function setRunning(running, status) {
        document.getElementById("run-button").disabled = running;
        document.getElementById("cancel-button").disabled = !running;
        document.getElementById("status").textContent = status ?? "";
      }

      function textCell(row, text) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.appendChild(cell);
        return cell;
      }

      function buttonCell(row, label, variant, onClick) {
        const cell = document.createElement("td");
        const button = document.createElement("sl-button");
        button.size = "small";
        button.variant = variant;
        button.textContent = label;
        button.addEventListener("click", (evt) => {
          evt.stopPropagation();
          onClick(button);
        });
        cell.appendChild(button);
        row.appendChild(cell);
        return button;
      }

      function whenToolElementsDefined() {
        return Promise.all(
          ["sl-input", "sl-radio-group", "sl-checkbox", "sl-button"].map((name) =>
            customElements.whenDefined(name),
          ),
        );
      }

      function setValue(id, value) {
        if (value !== undefined && value !== null) {
          document.getElementById(id).value = value;
        }
      }
    </script>`;
}

export function toolRunControls(runLabel: string): string {
  return `<div class="row mt-2">
        <div class="column">
          <sl-button variant="success" id="run-button" onclick="run()" class="mr-1">${runLabel}</sl-button>
          <sl-button variant="danger" id="cancel-button" onclick="vscode.postMessage({ command: 'cancel' })" disabled class="mr-1">Cancel</sl-button>
          <span id="status"></span>
        </div>
      </div>`;
}

export function toolLogSection(): string {
  return `<sl-details summary="Output" id="log-details" class="mt-2">
        <div id="log"></div>
      </sl-details>`;
}

export function gameRadioGroup(): string {
  return `<sl-radio-group label="Game?" value="jakx" fieldset id="game-name">
                <sl-radio-button value="jak1">Jak 1</sl-radio-button>
                <sl-radio-button value="jak2">Jak 2</sl-radio-button>
                <sl-radio-button value="jak3">Jak 3</sl-radio-button>
                <sl-radio-button value="jakx">Jak X</sl-radio-button>
              </sl-radio-group>`;
}
