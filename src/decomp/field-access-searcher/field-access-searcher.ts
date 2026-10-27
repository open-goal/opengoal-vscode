import { existsSync, readFileSync, rmSync } from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { getConfig, updateFieldAccessSearcherPath } from "../../config/config";
import { getExtensionContext } from "../../context";
import { GameName } from "../../utils/file-utils";
import { getDecompilerConfig, getDecompilerConfigVersion } from "../utils";
import {
  gameRadioGroup,
  getIR2EditorContext,
  handleToolMessages,
  IR2Location,
  openIR2Location,
  resolveToolPath,
  toolLogSection,
  toolRunControls,
  ToolProcess,
  toolWebviewHead,
} from "../tool-runner";

interface FieldAccess extends IR2Location {
  instruction: number;
  kind: "read" | "write" | "addr" | "ref";
  type: string;
  field: string;
  path: string;
  base_type: string;
  op_text: string;
  alternative: boolean;
}

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en" class="sl-theme-dark">

  <head>
    ${toolWebviewHead("Field Access Searcher", "#results tr { cursor: pointer; } #results tr:hover td { color: var(--sl-color-primary-600); } #kind-filters sl-checkbox { display: inline-block; margin-right: 1.5em; }")}
  </head>

  <body>
    <script defer>
      let currentGame = "jakx";
      let currentAccesses = [];
      let currentType = "";

      function run() {
        const objects = document.getElementById("objects").value
          .split(/[\\s,]+/)
          .filter((name) => name !== "");
        currentGame = document.getElementById("game-name").value;
        currentType = document.getElementById("type-name").value.trim();
        vscode.postMessage({
          command: "run",
          gameName: currentGame,
          typeName: currentType,
          fieldName: document.getElementById("field-name").value.trim(),
          exact: document.getElementById("exact").checked,
          supertypes: document.getElementById("supertypes").checked,
          alternatives: document.getElementById("alternatives").checked,
          verbose: document.getElementById("verbose").checked,
          objects: objects,
        });
      }

      function kindShown(kind) {
        const filter = kind === "ref" ? "addr" : kind;
        return document.getElementById("show-" + filter).checked;
      }

      function showResults() {
        const body = document.getElementById("results");
        body.innerHTML = "";
        const shown = currentAccesses.filter((access) => kindShown(access.kind));
        const counts = { read: 0, write: 0, addr: 0 };
        for (const access of currentAccesses) {
          counts[access.kind === "ref" ? "addr" : access.kind]++;
        }
        document.getElementById("result-count").textContent = currentAccesses.length +
          " access(es): " + counts.read + " read, " + counts.write + " write, " + counts.addr + " address" +
          (shown.length !== currentAccesses.length ? " (" + shown.length + " shown)" : "");
        for (const access of shown) {
          const row = document.createElement("tr");
          row.title = "Open in the IR2 file";
          textCell(row, access.object);
          textCell(row, access.function);
          textCell(row, "op " + access.op);
          textCell(row, access.label);
          textCell(row, access.kind);
          textCell(row, access.path).title = access.op_text;
          textCell(row, access.field + (access.type !== currentType ? " on " + access.type : ""));
          const notes = ["base " + access.base_type];
          if (access.alternative) {
            notes.push("alternative, the decompiler picked an overlapping field");
          }
          textCell(row, notes.join(", "));
          row.addEventListener("click", () => {
            vscode.postMessage({ command: "open", gameName: currentGame, access: access });
          });
          body.appendChild(row);
        }
      }

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message.command === "prefill") {
          setValue("game-name", message.gameName);
          setValue("type-name", message.typeName);
        } else if (message.command === "started") {
          clearLog();
          currentAccesses = [];
          showResults();
          document.getElementById("result-count").textContent = "";
          document.getElementById("command").textContent = message.commandLine;
          document.getElementById("log-details").open = true;
          setRunning(true, "Searching...");
        } else if (message.command === "output") {
          appendLog(message.text);
        } else if (message.command === "finished") {
          setRunning(false, message.status);
          if (message.accesses !== undefined) {
            currentAccesses = message.accesses;
            showResults();
          }
        }
      });

      whenToolElementsDefined().then(() => {
        for (const id of ["show-read", "show-write", "show-addr"]) {
          document.getElementById(id).addEventListener("sl-change", showResults);
        }
        vscode.postMessage({ command: "ready" });
      });
    </script>
    <div class="container">
      <div class="row">
        <div class="column column-50">
          <h2 class="mt-2">Field</h2>
          <div class="row">
            <div class="column">
              <sl-input label="Type?" id="type-name" help-text="The type the field belongs to"></sl-input>
            </div>
          </div>
          <div class="row">
            <div class="column">
              <sl-input label="Field?" id="field-name" help-text="Leave empty for every field of the type"></sl-input>
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
          <sl-checkbox id="exact">Only accesses on the type itself, not child types that inherit the field</sl-checkbox>
          <sl-checkbox id="supertypes">Include accesses on parent types that have the field</sl-checkbox>
          <sl-checkbox id="alternatives">Include overlay field accesses</sl-checkbox>
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
      <div id="kind-filters">
        <sl-checkbox id="show-read" checked>Reads</sl-checkbox>
        <sl-checkbox id="show-write" checked>Writes</sl-checkbox>
        <sl-checkbox id="show-addr" checked>Address calculations</sl-checkbox>
      </div>
      <table>
        <thead>
          <tr><th>Object</th><th>Function</th><th>Location</th><th>Label</th><th>Kind</th><th>Access</th><th>Field</th><th>Notes</th></tr>
        </thead>
        <tbody id="results"></tbody>
      </table>
    </div>
  </body>

  </html>
  `;
}

const resultsPath = path.join(os.tmpdir(), "opengoal-field-access-search.json");

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
  if (message.typeName === "") {
    vscode.window.showErrorMessage(
      "OpenGOAL - Give the type whose fields to search for",
    );
    return;
  }
  const binaryPath = await resolveToolPath(
    getConfig().fieldAccessSearcherPath,
    "field_access_searcher",
    updateFieldAccessSearcherPath,
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
    "--type",
    message.typeName,
  ];
  if (message.fieldName !== "") {
    args.push("--field", message.fieldName);
  }
  if (message.exact) {
    args.push("--exact");
  }
  if (message.supertypes) {
    args.push("--supertypes");
  }
  if (message.alternatives) {
    args.push("--alternatives");
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
  const accesses: FieldAccess[] = JSON.parse(
    readFileSync(resultsPath, { encoding: "utf-8" }),
  );
  currentPanel?.webview.postMessage({
    command: "finished",
    status: "Done",
    accesses: accesses,
  });
}

async function openPanel() {
  const editorContext = getIR2EditorContext();
  const prefill: any = { command: "prefill", gameName: editorContext.game };
  const methodMatch = editorContext.functionName?.match(
    /^\(method \d+ ([^\s)]+)\)$/,
  );
  if (methodMatch) {
    prefill.typeName = methodMatch[1];
  }

  if (currentPanel !== undefined) {
    currentPanel.reveal();
    currentPanel.webview.postMessage(prefill);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "fieldAccessSearcher",
    "Field Access Searcher",
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
      await openIR2Location(message.gameName, message.access);
    },
  });
}

export async function activateFieldAccessSearcher() {
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.fieldAccessSearcher.open",
      openPanel,
    ),
  );
}
