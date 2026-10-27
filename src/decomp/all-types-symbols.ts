import { promises as fs } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getExtensionContext, getProjectRoot } from "../context";
import { determineGameFromAllTypes } from "../utils/file-utils";

interface IR2Symbol {
  name: string;
  kind: "function" | "global";
  line: number;
}

interface IR2FileIndex {
  mtimeMs: number;
  size: number;
  symbols: IR2Symbol[];
}

interface SymbolItem extends vscode.QuickPickItem {
  filePath: string;
  line: number;
}

const IR2_SUFFIX = "_ir2.asm";
const READ_CONCURRENCY = 16;
const OPENGOAL_START = ";;-*-OpenGOAL-Start-*-";
const OPENGOAL_END = ";;-*-OpenGOAL-End-*-";
const LOCAL_VAR =
  /^((v[01]|a[0-3]|t[0-9]|s[0-7]|gp|sp|fp|ra|at|f[0-9]+|sv)-\d+|arg\d+|self)$/;

const indexCache = new Map<string, IR2FileIndex>();

function findGlobals(
  text: string,
  topLevelIndex: number,
  functionNames: Set<string>,
): { index: number; name: string }[] {
  const start = text.indexOf(OPENGOAL_START, topLevelIndex);
  const end = start === -1 ? -1 : text.indexOf(OPENGOAL_END, start);
  if (end === -1) {
    return [];
  }
  const globals: { index: number; name: string }[] = [];
  const seen = new Set<string>();
  const setRegex = /^[ \t]*\(set! ([^\s()]+)(?: (.*))?$/gm;
  setRegex.lastIndex = start;
  let match;
  while ((match = setRegex.exec(text)) !== null && match.index < end) {
    const name = match[1];
    if (
      seen.has(name) ||
      functionNames.has(name) ||
      LOCAL_VAR.test(name) ||
      /^L\d+\)/.test(match[2] ?? "")
    ) {
      continue;
    }
    seen.add(name);
    globals.push({ index: match.index, name: name });
  }
  return globals;
}

function indexIR2File(text: string): IR2Symbol[] {
  const found: { index: number; name: string; kind: IR2Symbol["kind"] }[] = [];
  const headerRegex = /^; \.function (.+?)\r?$/gm;
  let match;
  while ((match = headerRegex.exec(text)) !== null) {
    found.push({ index: match.index, name: match[1], kind: "function" });
  }
  const topLevel = found.find((symbol) =>
    symbol.name.startsWith("(top-level-login "),
  );
  if (topLevel !== undefined) {
    const functionNames = new Set(found.map((symbol) => symbol.name));
    for (const global of findGlobals(text, topLevel.index, functionNames)) {
      found.push({ ...global, kind: "global" });
    }
    found.sort((a, b) => a.index - b.index);
  }

  const symbols: IR2Symbol[] = [];
  let line = 0;
  let lastIndex = 0;
  for (const symbol of found) {
    for (let i = lastIndex; i < symbol.index; i++) {
      if (text.charCodeAt(i) === 10) {
        line++;
      }
    }
    lastIndex = symbol.index;
    symbols.push({ name: symbol.name, kind: symbol.kind, line: line });
  }
  return symbols;
}

// files are only re-read when they changed since the last time the picker was opened
async function indexIR2Files(dir: string): Promise<Map<string, IR2Symbol[]>> {
  const fileNames = (await fs.readdir(dir))
    .filter((name) => name.endsWith(IR2_SUFFIX))
    .sort();
  const result = new Map<string, IR2Symbol[]>();
  let next = 0;
  const worker = async () => {
    while (next < fileNames.length) {
      const filePath = path.join(dir, fileNames[next++]);
      const stat = await fs.stat(filePath);
      let index = indexCache.get(filePath);
      if (
        index === undefined ||
        index.mtimeMs !== stat.mtimeMs ||
        index.size !== stat.size
      ) {
        const text = await fs.readFile(filePath, { encoding: "utf-8" });
        index = {
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          symbols: indexIR2File(text),
        };
        indexCache.set(filePath, index);
      }
      result.set(filePath, index.symbols);
    }
  };
  await Promise.all(Array.from({ length: READ_CONCURRENCY }, worker));
  return result;
}

function symbolIcon(symbol: IR2Symbol): string {
  if (symbol.kind === "global") {
    return "$(symbol-variable)";
  } else if (symbol.name.startsWith("(method ")) {
    return "$(symbol-method)";
  } else if (symbol.name.startsWith("(top-level-login ")) {
    return "$(symbol-namespace)";
  }
  return "$(symbol-function)";
}

function buildItems(files: Map<string, IR2Symbol[]>): SymbolItem[] {
  const items: SymbolItem[] = [];
  for (const [filePath, symbols] of files) {
    const objectName = path.basename(filePath).slice(0, -IR2_SUFFIX.length);
    items.push({
      label: `$(file-code) ${objectName}`,
      description: "object file",
      filePath: filePath,
      line: 0,
    });
    for (const symbol of symbols) {
      items.push({
        label: `${symbolIcon(symbol)} ${symbol.name}`,
        description: objectName,
        filePath: filePath,
        line: symbol.line,
      });
    }
  }
  return items;
}

async function openSymbolPicker() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }
  const gameName = determineGameFromAllTypes(editor.document.uri);
  if (gameName === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to determine the game from the all-types file's path",
    );
    return;
  }
  const dir = vscode.Uri.joinPath(
    getProjectRoot(),
    "decompiler_out",
    gameName,
  ).fsPath;

  const picker = vscode.window.createQuickPick<SymbolItem>();
  picker.title = `OpenGOAL - ${gameName} IR2 Symbols`;
  picker.placeholder = "Search functions, methods, globals and object files";
  picker.matchOnDescription = true;
  picker.busy = true;
  picker.onDidHide(() => picker.dispose());
  picker.onDidAccept(async () => {
    const selection = picker.selectedItems[0];
    if (selection === undefined) {
      return;
    }
    picker.hide();
    const position = new vscode.Position(selection.line, 0);
    await vscode.window.showTextDocument(vscode.Uri.file(selection.filePath), {
      viewColumn: vscode.ViewColumn.Active,
      selection: new vscode.Range(position, position),
    });
  });
  picker.show();

  try {
    picker.items = buildItems(await indexIR2Files(dir));
  } catch (error) {
    picker.hide();
    vscode.window.showErrorMessage(
      `OpenGOAL - Unable to read the IR2 files in ${dir}: ${error}`,
    );
    return;
  }
  picker.busy = false;
}

export function activateAllTypesSymbols() {
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.allTypes.goToIR2Symbol",
      openSymbolPicker,
    ),
  );
}
