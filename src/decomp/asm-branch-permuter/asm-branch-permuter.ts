import { parse } from "comment-json";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { getConfig, updateAsmBranchPermuterPath } from "../../config/config";
import { getExtensionContext, getProjectRoot } from "../../context";
import { GameName } from "../../utils/file-utils";
import {
  getCastFilePathForGame,
  getDecompilerConfig,
  getDecompilerConfigVersion,
} from "../utils";
import {
  gameRadioGroup,
  getIR2EditorContext,
  handleToolMessages,
  resolveToolPath,
  toolLogSection,
  toolRunControls,
  ToolProcess,
  toolWebviewHead,
} from "../tool-runner";

interface PermuterEntry {
  name: string;
  object?: string;
  status: string;
  blocks?: number[];
  before?: number[];
  notes?: string;
}

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en" class="sl-theme-dark">

  <head>
    ${toolWebviewHead("ASM Branch Permuter")}
  </head>

  <body>
    <script defer>
      let currentGame = "jakx";
      let applyButtons = {};

      function inputValue(id) {
        return document.getElementById(id).value.trim();
      }

      function updateMode() {
        const mode = document.getElementById("mode").value;
        const single = mode === "search" || mode === "trim";
        document.getElementById("function-row").classList.toggle("hidden", !single);
        document.getElementById("search-options").classList.toggle("hidden", mode !== "search" && mode !== "try-asm");
        document.getElementById("block-options").classList.toggle("hidden", mode !== "search");
      }

      function run() {
        currentGame = document.getElementById("game-name").value;
        const options = {};
        for (const id of ["require", "candidates", "time-limit", "max-size", "max-results", "jobs",
                          "exhaustive-budget", "beam-width", "max-verify"]) {
          options[id] = inputValue(id);
        }
        vscode.postMessage({
          command: "run",
          gameName: currentGame,
          mode: document.getElementById("mode").value,
          functionName: inputValue("function-name"),
          objectName: inputValue("object-name"),
          options: options,
          noVerify: document.getElementById("no-verify").checked,
          print: document.getElementById("print").checked,
          verbose: document.getElementById("verbose").checked,
        });
      }

      function formatBlocks(blocks) {
        return "[" + blocks.join(", ") + "]";
      }

      function apply(entries) {
        vscode.postMessage({
          command: "apply",
          gameName: currentGame,
          entries: entries.map((entry) => ({ name: entry.name, blocks: entry.blocks })),
        });
      }

      function showResults(entries) {
        const body = document.getElementById("results");
        body.innerHTML = "";
        applyButtons = {};
        const applicable = entries.filter((entry) => entry.blocks !== undefined);
        for (const entry of entries) {
          const row = document.createElement("tr");
          textCell(row, entry.name);
          textCell(row, entry.object ?? "");
          textCell(row, entry.status);
          let blocks = entry.blocks !== undefined ? formatBlocks(entry.blocks) : "";
          if (entry.before !== undefined && entry.blocks !== undefined) {
            blocks = formatBlocks(entry.before) + " -> " + blocks;
          }
          textCell(row, blocks);
          textCell(row, entry.notes ?? "");
          if (entry.blocks !== undefined) {
            applyButtons[entry.name] = buttonCell(row, "Apply", "primary", () => apply([entry]));
          } else {
            textCell(row, "");
          }
          body.appendChild(row);
        }
        const applyAll = document.getElementById("apply-all");
        applyAll.classList.toggle("hidden", applicable.length < 2);
        applyAll.disabled = false;
        applyAll.onclick = () => apply(applicable);
        document.getElementById("result-section").classList.toggle("hidden", entries.length === 0);
      }

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message.command === "prefill") {
          setValue("game-name", message.gameName);
          setValue("object-name", message.objectName);
          setValue("function-name", message.functionName);
        } else if (message.command === "started") {
          clearLog();
          showResults([]);
          document.getElementById("command").textContent = message.commandLine;
          document.getElementById("log-details").open = true;
          setRunning(true, "Running...");
        } else if (message.command === "output") {
          appendLog(message.text);
        } else if (message.command === "finished") {
          setRunning(false, message.status);
          if (message.entries !== undefined) {
            showResults(message.entries);
          }
        } else if (message.command === "applied") {
          for (const name of message.names) {
            const button = applyButtons[name];
            if (button !== undefined) {
              button.textContent = "Applied";
              button.disabled = true;
            }
          }
          if (Object.values(applyButtons).every((button) => button.disabled)) {
            document.getElementById("apply-all").disabled = true;
          }
        }
      });

      whenToolElementsDefined().then(() => {
        document.getElementById("mode").addEventListener("sl-change", updateMode);
        document.getElementById("mode").addEventListener("click", () => setTimeout(updateMode));
        updateMode();
        vscode.postMessage({ command: "ready" });
      });
    </script>
    <div class="container">
      <div class="row">
        <div class="column column-50">
          <h2 class="mt-2">Target</h2>
          <div class="row">
            <div class="column">
              <sl-radio-group label="Mode?" value="search" fieldset id="mode">
                <sl-radio-button value="search">Search</sl-radio-button>
                <sl-radio-button value="trim">Trim Entry</sl-radio-button>
                <sl-radio-button value="trim-all">Trim All Entries</sl-radio-button>
                <sl-radio-button value="try-asm">Try ASM Functions</sl-radio-button>
              </sl-radio-group>
            </div>
          </div>
          <div class="row mt-1" id="function-row">
            <div class="column">
              <sl-input label="Function?" id="function-name" help-text='e.g. "(method 22 collide-cache)"'></sl-input>
            </div>
          </div>
          <div class="row">
            <div class="column">
              <sl-input label="Object?" id="object-name" help-text="Only load this object (much faster). Defaults to the config's allowed_objects"></sl-input>
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
          <div id="block-options">
            <div class="row">
              <div class="column">
                <sl-input label="Required Blocks?" id="require" help-text="Comma separated, always in the set"></sl-input>
              </div>
              <div class="column">
                <sl-input label="Candidate Blocks?" id="candidates" help-text="Comma separated. Defaults to every block ending in a branch"></sl-input>
              </div>
            </div>
          </div>
          <div id="search-options">
            <div class="row">
              <div class="column">
                <sl-input label="Time Limit?" id="time-limit" type="number" help-text="Seconds per function, 0 for none"></sl-input>
              </div>
              <div class="column">
                <sl-input label="Max Size?" id="max-size" type="number" help-text="Max blocks in a set, 0 for none"></sl-input>
              </div>
            </div>
            <sl-checkbox id="no-verify">Only require the cfg to resolve, don't decompile the result</sl-checkbox>
            <sl-checkbox id="print">Print the decompiled function for the result</sl-checkbox>
          </div>
          <sl-checkbox id="verbose">Verbose output</sl-checkbox>
          <sl-details summary="Advanced" class="mt-1">
            <div class="row">
              <div class="column">
                <sl-input label="Jobs?" id="jobs" type="number" help-text="Worker processes, defaults to core count"></sl-input>
              </div>
              <div class="column">
                <sl-input label="Max Results?" id="max-results" type="number" help-text="Alternative sets to list"></sl-input>
              </div>
            </div>
            <div class="row">
              <div class="column">
                <sl-input label="Exhaustive Budget?" id="exhaustive-budget" type="number"></sl-input>
              </div>
              <div class="column">
                <sl-input label="Beam Width?" id="beam-width" type="number"></sl-input>
              </div>
              <div class="column">
                <sl-input label="Max Verify?" id="max-verify" type="number"></sl-input>
              </div>
            </div>
          </sl-details>
        </div>
      </div>
      ${toolRunControls("Run")}
      <div class="row">
        <div class="column"><code id="command"></code></div>
      </div>
      ${toolLogSection()}
      <div id="result-section" class="hidden">
        <h2 class="mt-2">Results</h2>
        <sl-button variant="primary" id="apply-all" class="hidden">Apply All to hacks.jsonc</sl-button>
        <table>
          <thead>
            <tr><th>Function</th><th>Object</th><th>Status</th><th>Blocks</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody id="results"></tbody>
        </table>
      </div>
    </div>
  </body>

  </html>
  `;
}

const resultsPath = path.join(os.tmpdir(), "opengoal-asm-branch-permuter.json");

let currentPanel: vscode.WebviewPanel | undefined = undefined;
const tool = new ToolProcess();

function buildArgs(message: any, configPath: string): string[] | undefined {
  const args = [
    configPath,
    "./iso_data",
    "--version",
    getDecompilerConfigVersion(message.gameName),
  ];
  const mode: string = message.mode;
  if (mode === "search" || mode === "trim") {
    if (message.functionName === "") {
      vscode.window.showErrorMessage(
        "OpenGOAL - Give the function to run the permuter on",
      );
      return undefined;
    }
    args.push("--function", message.functionName);
  }
  if (mode === "trim" || mode === "trim-all") {
    args.push("--trim");
  } else if (mode === "try-asm") {
    args.push("--try-asm");
  }
  if (mode === "trim-all" || mode === "try-asm") {
    args.push("--output-path", resultsPath);
  }
  if (message.objectName !== "") {
    args.push("--obj", message.objectName);
  }

  const options: Record<string, string> = message.options;
  const relevant =
    mode === "search"
      ? Object.keys(options)
      : mode === "try-asm"
        ? ["time-limit", "max-size", "jobs", "exhaustive-budget", "beam-width"]
        : ["jobs"];
  for (const key of relevant) {
    if (options[key] !== "") {
      args.push(`--${key}`, options[key]);
    }
  }
  if (mode === "search" && message.noVerify) {
    args.push("--no-verify");
  }
  if (mode === "search" && message.print) {
    args.push("--print");
  }
  if (message.verbose) {
    args.push("--verbose");
  }
  return args;
}

function parseSingleResult(output: string): PermuterEntry | undefined {
  const matches = [
    ...output.matchAll(/^ {4}("(?:[^"\\]|\\.)*"): (\[[\d, ]*\]),\r?$/gm),
  ];
  if (matches.length == 0) {
    return undefined;
  }
  const match = matches[matches.length - 1];
  return {
    name: JSON.parse(match[1]),
    status: "found",
    blocks: JSON.parse(match[2]),
  };
}

function parseResultsFile(mode: string): PermuterEntry[] {
  const results = JSON.parse(readFileSync(resultsPath, { encoding: "utf-8" }));
  const entries: PermuterEntry[] = [];
  for (const [name, result] of Object.entries<any>(results)) {
    const entry: PermuterEntry = {
      name: name,
      object: result.object,
      status: result.status,
    };
    if (mode === "trim-all") {
      if (result.level !== undefined) {
        entry.notes = result.level;
      }
      if (result.after.length < result.before.length) {
        entry.before = result.before;
        entry.blocks = result.after;
      }
    } else {
      entry.notes = result.lists;
      if (result.level !== undefined) {
        entry.status += ` - ${result.level}`;
      }
      if (result.status === "found") {
        entry.blocks = result.set;
        entry.notes += ", remove it from the list after applying";
      } else if (result.closest !== undefined) {
        entry.notes += `, closest: [${result.closest.join(", ")}]`;
      }
    }
    entries.push(entry);
  }
  return entries;
}

async function runPermuter(message: any) {
  const gameName = message.gameName as GameName;
  const configPath = getDecompilerConfig(gameName);
  if (configPath === undefined) {
    vscode.window.showErrorMessage(
      `OpenGOAL - Unable to locate the decompiler config for ${gameName}`,
    );
    return;
  }
  const args = buildArgs(message, configPath);
  if (args === undefined) {
    return;
  }
  const binaryPath = await resolveToolPath(
    getConfig().asmBranchPermuterPath,
    "asm_branch_permuter",
    updateAsmBranchPermuterPath,
  );
  if (binaryPath === undefined) {
    return;
  }

  rmSync(resultsPath, { force: true });
  currentPanel?.webview.postMessage({
    command: "started",
    commandLine: `${path.basename(binaryPath)} ${args.join(" ")}`,
  });
  let output = "";
  const exitCode = await tool.run(binaryPath, args, (text) => {
    output += text;
    currentPanel?.webview.postMessage({ command: "output", text: text });
  });

  const mode: string = message.mode;
  let entries: PermuterEntry[] | undefined = undefined;
  if (exitCode === 0) {
    if (mode === "search" || mode === "trim") {
      const entry = parseSingleResult(output);
      entries = entry === undefined ? undefined : [entry];
    } else if (existsSync(resultsPath)) {
      entries = parseResultsFile(mode);
    }
  }
  let status = "Done";
  if (exitCode === null) {
    status = "Cancelled";
  } else if (entries === undefined) {
    status =
      mode === "search" && exitCode === 1
        ? "No working set found, see the output"
        : `Failed (exit code ${exitCode}), see the output`;
  }
  currentPanel?.webview.postMessage({
    command: "finished",
    status: status,
    entries: entries,
  });
}

function findClosingBrace(text: string, start: number): number | undefined {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) {
        if (text[i] === "\\") {
          i++;
        }
      }
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        i++;
      }
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i === -1) {
        return undefined;
      }
      i++;
    } else if (c === "{") {
      depth++;
    } else if (c === "}" && --depth === 0) {
      return i;
    }
  }
  return undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setAsmBranchEntries(
  text: string,
  entries: { name: string; blocks: number[] }[],
): string | undefined {
  for (const entry of entries) {
    const section = /"blocks_ending_in_asm_branch"\s*:\s*\{/.exec(text);
    if (section === null) {
      return undefined;
    }
    const start = section.index + section[0].length;
    const end = findClosingBrace(text, start);
    if (end === undefined) {
      return undefined;
    }
    const key = JSON.stringify(entry.name);
    const value = `[${entry.blocks.join(", ")}]`;

    const existing = new RegExp(
      `${escapeRegex(key)}\\s*:\\s*\\[[^\\]]*\\]`,
    ).exec(text.slice(start, end));
    if (existing !== null) {
      const from = start + existing.index;
      text =
        text.slice(0, from) +
        `${key}: ${value}` +
        text.slice(from + existing[0].length);
      continue;
    }

    const before = text.slice(0, end);
    const closingIndent = before.slice(before.lastIndexOf("\n") + 1);
    const indent = /^\s*$/.test(closingIndent) ? closingIndent : "";
    const trimmed = before.trimEnd();
    const comma = trimmed.endsWith("{") || trimmed.endsWith(",") ? "" : ",";
    text =
      `${trimmed}${comma}\n${indent}  ${key}: ${value}\n${indent}` +
      text.slice(end);
  }
  return text;
}

async function applyEntries(
  gameName: GameName,
  entries: { name: string; blocks: number[] }[],
) {
  const hacksPath = getCastFilePathForGame(
    getProjectRoot(),
    gameName,
    "hacks.jsonc",
  );
  if (!existsSync(hacksPath)) {
    vscode.window.showErrorMessage(
      `OpenGOAL - Unable to locate '${hacksPath}'`,
    );
    return;
  }
  const updated = setAsmBranchEntries(
    readFileSync(hacksPath, { encoding: "utf-8" }),
    entries,
  );
  if (updated === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Couldn't find 'blocks_ending_in_asm_branch' in hacks.jsonc",
    );
    return;
  }
  try {
    parse(updated);
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `OpenGOAL - Updating hacks.jsonc would have left it invalid, nothing was written: ${error}`,
    );
    return;
  }
  writeFileSync(hacksPath, updated);
  currentPanel?.webview.postMessage({
    command: "applied",
    names: entries.map((entry) => entry.name),
  });
  vscode.window.showInformationMessage(
    `OpenGOAL - Updated ${entries.length} blocks_ending_in_asm_branch entr${entries.length == 1 ? "y" : "ies"} in ${gameName} hacks.jsonc`,
  );
}

async function openPanel() {
  const editorContext = getIR2EditorContext();
  const prefill = {
    command: "prefill",
    gameName: editorContext.game,
    objectName: editorContext.object,
    functionName: editorContext.functionName,
  };

  if (currentPanel !== undefined) {
    currentPanel.reveal();
    currentPanel.webview.postMessage(prefill);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "asmBranchPermuter",
    "ASM Branch Permuter",
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
        await runPermuter(message);
      }
    },
    cancel: () => tool.cancel(),
    apply: async (message) => {
      await applyEntries(message.gameName, message.entries);
    },
  });
}

export async function activateAsmBranchPermuter() {
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.asmBranchPermuter.open",
      openPanel,
    ),
  );
}
