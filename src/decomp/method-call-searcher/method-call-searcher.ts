import { existsSync, readFileSync, rmSync } from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { getConfig, updateMethodCallSearcherPath } from "../../config/config";
import { getExtensionContext } from "../../context";
import { GameName } from "../../utils/file-utils";
import { getDecompilerConfig, getDecompilerConfigVersion } from "../utils";
import {
  gameRadioGroup,
  getIR2EditorContext,
  handleToolMessages,
  openIR2Location,
  resolveToolPath,
  toolLogSection,
  toolRunControls,
  ToolProcess,
  toolWebviewHead,
} from "../tool-runner";

interface MethodCall {
  object: string;
  function: string;
  instruction: number;
  op: number;
  label: string;
  type: string | null;
  method_id: number;
  method_name: string;
  virtual: boolean;
  source: "types" | "pattern";
}

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en" class="sl-theme-dark">

  <head>
    ${toolWebviewHead("Method Call Searcher", "#results tr { cursor: pointer; } #results tr:hover td { color: var(--sl-color-primary-600); }")}
  </head>

  <body>
    <script defer>
      let currentGame = "jakx";

      function run() {
        const objects = document.getElementById("objects").value
          .split(/[\\s,]+/)
          .filter((name) => name !== "");
        currentGame = document.getElementById("game-name").value;
        vscode.postMessage({
          command: "run",
          gameName: currentGame,
          typeName: document.getElementById("type-name").value.trim(),
          method: document.getElementById("method").value.trim(),
          subtypes: document.getElementById("subtypes").checked,
          supertypes: document.getElementById("supertypes").checked,
          unresolved: document.getElementById("unresolved").checked,
          verbose: document.getElementById("verbose").checked,
          objects: objects,
        });
      }

      function describeMethod(call) {
        let method = "(method " + call.method_id + " " + (call.type ?? "<unknown type>") + ")";
        if (call.method_name !== "") {
          method += " " + call.method_name;
        }
        return method;
      }

      function showResults(calls) {
        const body = document.getElementById("results");
        body.innerHTML = "";
        document.getElementById("result-count").textContent = calls.length + " call(s)";
        for (const call of calls) {
          const row = document.createElement("tr");
          row.title = "Open in the IR2 file";
          textCell(row, call.object);
          textCell(row, call.function);
          textCell(row, call.op >= 0 ? "op " + call.op : "instr " + call.instruction);
          textCell(row, call.label);
          textCell(row, describeMethod(call));
          const notes = [call.virtual ? "virtual" : "non-virtual"];
          if (call.source !== "types") {
            notes.push("pattern match, no type info");
          }
          textCell(row, notes.join(", "));
          row.addEventListener("click", () => {
            vscode.postMessage({ command: "open", gameName: currentGame, call: call });
          });
          body.appendChild(row);
        }
      }

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message.command === "prefill") {
          setValue("game-name", message.gameName);
          setValue("type-name", message.typeName);
          setValue("method", message.method);
        } else if (message.command === "started") {
          clearLog();
          document.getElementById("results").innerHTML = "";
          document.getElementById("result-count").textContent = "";
          document.getElementById("command").textContent = message.commandLine;
          document.getElementById("log-details").open = true;
          setRunning(true, "Searching...");
        } else if (message.command === "output") {
          appendLog(message.text);
        } else if (message.command === "finished") {
          setRunning(false, message.status);
          if (message.calls !== undefined) {
            showResults(message.calls);
          }
        }
      });
    </script>
    <div class="container">
      <div class="row">
        <div class="column column-50">
          <h2 class="mt-2">Method</h2>
          <div class="row">
            <div class="column">
              <sl-input label="Type?" id="type-name" help-text="The type the method is called on"></sl-input>
            </div>
          </div>
          <div class="row">
            <div class="column">
              <sl-input label="Method?" id="method" help-text="A method id, or its name (needs a type). Leave empty for every method of the type"></sl-input>
            </div>
          </div>
          <div class="row mt-1">
            <div class="column">
              ${gameRadioGroup()}
            </div>
          </div>
        </div>
        <div class="column column-50">
          <h2 class="mt-2">Options</h2>
          <sl-checkbox id="subtypes">Include calls on child types that inherit the method</sl-checkbox>
          <sl-checkbox id="supertypes">Include calls on parent types</sl-checkbox>
          <sl-checkbox id="unresolved">Include calls where the type couldn't be determined (needs a numeric method)</sl-checkbox>
          <sl-checkbox id="verbose">Verbose output</sl-checkbox>
          <div class="row mt-1">
            <div class="column">
              <sl-input label="Objects?" id="objects" help-text="Space or comma separated. Leave empty to search every object (slow)"></sl-input>
            </div>
          </div>
        </div>
      </div>
      ${toolRunControls("Search")}
      <div class="row">
        <div class="column"><code id="command"></code></div>
      </div>
      ${toolLogSection()}
      <h2 class="mt-2">Results <small id="result-count"></small></h2>
      <table>
        <thead>
          <tr><th>Object</th><th>Function</th><th>Location</th><th>Label</th><th>Method</th><th>Notes</th></tr>
        </thead>
        <tbody id="results"></tbody>
      </table>
    </div>
    <script>whenToolElementsDefined().then(() => vscode.postMessage({ command: "ready" }));</script>
  </body>

  </html>
  `;
}

const resultsPath = path.join(os.tmpdir(), "opengoal-method-call-search.json");

let currentPanel: vscode.WebviewPanel | undefined = undefined;
const tool = new ToolProcess();

async function runSearch(message: any) {
  const gameName = message.gameName as GameName;
  const configPath = getDecompilerConfig(gameName);
  if (configPath === undefined) {
    vscode.window.showErrorMessage(
      `OpenGOAL - Unable to locate the decompiler config for ${gameName}`,
    );
    return;
  }
  if (message.typeName === "" && message.method === "") {
    vscode.window.showErrorMessage(
      "OpenGOAL - Give a type, a method, or both to search for",
    );
    return;
  }
  const binaryPath = await resolveToolPath(
    getConfig().methodCallSearcherPath,
    "method_call_searcher",
    updateMethodCallSearcherPath,
  );
  if (binaryPath === undefined) {
    return;
  }

  const args = [
    configPath,
    "./iso_data",
    "--version",
    getDecompilerConfigVersion(gameName),
    "--output-path",
    resultsPath,
  ];
  if (message.typeName !== "") {
    args.push("--type", message.typeName);
  }
  if (message.method !== "") {
    args.push("--method", message.method);
  }
  if (message.subtypes) {
    args.push("--subtypes");
  }
  if (message.supertypes) {
    args.push("--supertypes");
  }
  if (message.unresolved) {
    args.push("--unresolved");
  }
  if (message.verbose) {
    args.push("--verbose");
  }
  for (const obj of message.objects) {
    args.push("--obj", obj);
  }

  rmSync(resultsPath, { force: true });
  currentPanel?.webview.postMessage({
    command: "started",
    commandLine: `${path.basename(binaryPath)} ${args.join(" ")}`,
  });
  const exitCode = await tool.run(binaryPath, args, (text) =>
    currentPanel?.webview.postMessage({ command: "output", text: text }),
  );

  if (exitCode !== 0 || !existsSync(resultsPath)) {
    currentPanel?.webview.postMessage({
      command: "finished",
      status:
        exitCode === null ? "Cancelled" : `Failed (exit code ${exitCode})`,
    });
    return;
  }
  const calls: MethodCall[] = JSON.parse(
    readFileSync(resultsPath, { encoding: "utf-8" }),
  );
  currentPanel?.webview.postMessage({
    command: "finished",
    status: "Done",
    calls: calls,
  });
}

async function openPanel() {
  const editorContext = getIR2EditorContext();
  const prefill: any = { command: "prefill", gameName: editorContext.game };
  const methodMatch = editorContext.functionName?.match(
    /^\(method (\d+) ([^\s)]+)\)$/,
  );
  if (methodMatch) {
    prefill.method = methodMatch[1];
    prefill.typeName = methodMatch[2];
  }

  if (currentPanel !== undefined) {
    currentPanel.reveal();
    currentPanel.webview.postMessage(prefill);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "methodCallSearcher",
    "Method Call Searcher",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );
  currentPanel.webview.html = getWebviewContent();

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
      tool.cancel();
    },
    undefined,
    getExtensionContext().subscriptions,
  );

  handleToolMessages(currentPanel, {
    ready: () => {
      currentPanel?.webview.postMessage(prefill);
    },
    run: async (message) => {
      if (!tool.running) {
        await runSearch(message);
      }
    },
    cancel: () => tool.cancel(),
    open: async (message) => {
      await openIR2Location(message.gameName, message.call);
    },
  });
}

export async function activateMethodCallSearcher() {
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.methodCallSearcher.open",
      openPanel,
    ),
  );
}
