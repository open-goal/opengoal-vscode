import { getExtensionContext, getProjectRoot } from "../context";
import * as vscode from "vscode";
import { basename, join } from "path";
import { fstat, readFileSync, writeFileSync } from "fs";
import { parse, stringify } from "comment-json";
import { getFuncNameFromSelection } from "../languages/ir2/ir2-utils";
import { getDecompilerConfigDirectory } from "./utils";
import { determineGameFromPath, GameName } from "../utils/file-utils";
import { getConfig, updateTypeSearcherPath } from "../config/config";
import { existsSync } from "fs";
import * as util from "util";
import { execFile } from "child_process";
const execFileAsync = util.promisify(execFile);

enum CastKind {
  Label,
  Stack,
  TypeCast,
}

let lastCastKind: CastKind | undefined;
let lastLabelCastType: string | undefined;
let lastLabelCastSize: number | undefined;
let lastStackCastType: string | undefined;
let lastTypeCastRegister: string | undefined;
let lastTypeCastType: string | undefined;

const opNumRegex = /.*;; \[\s*(\d+)\]/g;
const registerRegex = /[a|s|t|v|f]\d+|gp|fp|r0|ra/g;
const stackOffsetRegex = /sp, (\d+)/g;
const labelRefRegex = /(L\d+).*;;/g;

class CastContext {
  startOp: number;
  endOp: number | undefined;
  constructor(start: number, end?: number) {
    this.startOp = start;
    this.endOp = end;
  }
}

const typeCastSuggestions = new Map<GameName, string[]>();
const recentLabelCasts = new Map<GameName, string[]>();
const recentTypeCasts = new Map<GameName, string[]>();
const recentStackCasts = new Map<GameName, string[]>();

function defaultTypeSearcherPath() {
  const platform = process.platform;
  if (platform == "win32") {
    return "out/build/Release/bin/type_searcher.exe";
  } else {
    return "build/tools/type_searcher";
  }
}

async function checkTypeSearcherPath(): Promise<string | undefined> {
  let typeSearcherPath = getConfig().typeSearcherPath;

  // Look for the decompiler if the path isn't set or the file is now missing
  if (typeSearcherPath !== undefined && existsSync(typeSearcherPath)) {
    return typeSearcherPath;
  }

  const potentialPath = vscode.Uri.joinPath(
    getProjectRoot(),
    defaultTypeSearcherPath()
  );
  if (existsSync(potentialPath.fsPath)) {
    typeSearcherPath = potentialPath.fsPath;
  } else {
    // Ask the user to find it cause we have no idea
    const path = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: "Select Type Searcher",
      title: "Provide the type searcher executable's path",
    });
    if (path === undefined || path.length == 0) {
      return undefined;
    }
    typeSearcherPath = path[0].fsPath;
  }
  updateTypeSearcherPath(typeSearcherPath);
  return typeSearcherPath;
}

export async function updateTypeCastSuggestions(gameName: GameName) {
  const typeSearcherPath = await checkTypeSearcherPath();
  if (!typeSearcherPath) {
    return;
  }

  try {
    const jsonPath = vscode.Uri.joinPath(
      getExtensionContext().extensionUri,
      `${gameName.toString()}-types.json`
    ).fsPath;
    await execFileAsync(
      typeSearcherPath,
      [`--game`, gameName.toString(), `--output-path`, jsonPath, `--all`],
      {
        encoding: "utf8",
        cwd: getProjectRoot().fsPath,
        timeout: 20000,
      }
    );
    if (existsSync(jsonPath)) {
      const result = readFileSync(jsonPath, { encoding: "utf-8" });
      typeCastSuggestions.set(gameName, JSON.parse(result));
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(
      "Couldn't get a list of all types to use for casting suggestions"
    );
  }
}

async function getOpNumber(line: string): Promise<number | undefined> {
  const matches = [...line.matchAll(opNumRegex)];
  if (matches.length == 1) {
    return parseInt(matches[0][1].toString());
  }
  await vscode.window.showErrorMessage("Couldn't determine operation number");
  return undefined;
}

async function getLabelReference(line: string): Promise<string | undefined> {
  const matches = [...line.matchAll(labelRefRegex)];
  if (matches.length == 1) {
    return matches[0][1].toString();
  }
  await vscode.window.showErrorMessage("Couldn't determine label reference");
  return undefined;
}

async function applyLabelCast(
  editor: vscode.TextEditor,
  objectName: string,
  labelRef: string,
  castToType: string,
  pointerSize?: number
) {
  const configDir = await getDecompilerConfigDirectory(editor.document.uri);
  if (configDir === undefined) {
    return;
  }
  const filePath = join(configDir, "label_types.jsonc");

  const json: any = parse(readFileSync(filePath).toString());
  // Add our new entry
  if (objectName in json) {
    if (pointerSize === undefined) {
      if (castToType === "uint64" || castToType === "float") {
        json[objectName].push([labelRef, castToType, true]);
      } else {
        json[objectName].push([labelRef, castToType]);
      }
    } else {
      json[objectName].push([labelRef, castToType, pointerSize]);
    }
  } else {
    if (pointerSize === undefined) {
      if (castToType === "uint64" || castToType === "float") {
        json[objectName] = [[labelRef, castToType, true]];
      } else {
        json[objectName] = [[labelRef, castToType]];
      }
    } else {
      json[objectName] = [[labelRef, castToType, pointerSize]];
    }
  }

  writeFileSync(filePath, stringify(json, null, 2));
}

async function validActiveFile(editor: vscode.TextEditor): Promise<boolean> {
  if (!editor.document === undefined) {
    await vscode.window.showErrorMessage(
      "No active file open, can't decompile!"
    );
    return false;
  }

  const fileName = basename(editor.document.fileName);
  if (!fileName.match(/.*_ir2\.asm/)) {
    await vscode.window.showErrorMessage(
      "Current file is not a valid IR2 file."
    );
    return false;
  }
  return true;
}

function generateCastSelectionItems(
  fullList: string[] | undefined,
  recentList: string[] | undefined
): vscode.QuickPickItem[] {
  const items: vscode.QuickPickItem[] = [];
  if (recentList !== undefined && recentList.length > 0) {
    items.push({
      label: "Recent Casts",
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const name of recentList) {
      items.push({
        label: name,
      });
    }
  }
  if (fullList !== undefined && fullList.length > 0) {
    items.push({
      label: "All Types",
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const name of fullList) {
      items.push({
        label: name,
      });
    }
  }
  return items;
}

async function initTypeCastSuggestions(gameName: GameName | undefined) {
  if (gameName !== undefined && typeCastSuggestions.size === 0) {
    await updateTypeCastSuggestions(gameName);
    if (recentLabelCasts.get(gameName) === undefined) {
      recentLabelCasts.set(gameName, []);
    }
    if (recentTypeCasts.get(gameName) === undefined) {
      recentTypeCasts.set(gameName, []);
    }
    if (recentStackCasts.get(gameName) === undefined) {
      recentStackCasts.set(gameName, []);
    }
  }
}

async function labelCastSelection() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || !validActiveFile(editor)) {
    return;
  }

  const objectName = basename(editor.document.fileName).split("_ir2.asm")[0];

  // Get the stack index
  const labelRef = await getLabelReference(
    editor.document.lineAt(editor.selection.start.line).text
  );
  if (labelRef === undefined) {
    return;
  }

  // Get what we should cast to
  const gameName = determineGameFromPath(editor.document.uri);
  await initTypeCastSuggestions(gameName);
  if (gameName === undefined) {
    await vscode.window.showErrorMessage("Couldn't determine game version");
    return;
  }

  const items = generateCastSelectionItems(
    typeCastSuggestions.get(gameName),
    recentLabelCasts.get(gameName)
  );
  let castToType;
  if (items.length > 0) {
    castToType = (
      await vscode.window.showQuickPick(items, {
        title: "Cast to Type?",
      })
    )?.label;
  } else {
    castToType = await vscode.window.showInputBox({
      title: "Cast to Type?",
    });
  }

  if (castToType === undefined || castToType.trim() === "") {
    await vscode.window.showErrorMessage("Can't cast if no type is provided");
    return;
  }
  // If the label is a pointer, ask for a size
  let pointerSize = undefined;
  if (castToType.includes("pointer")) {
    pointerSize = await vscode.window.showInputBox({
      title: "Pointer Size?",
    });
    if (pointerSize === undefined) {
      await vscode.window.showErrorMessage("Provide a pointer size!");
      return;
    }
    pointerSize = parseInt(pointerSize);
  }

  // Finally, do the cast!
  await applyLabelCast(
    editor,
    objectName,
    labelRef,
    castToType.trim(),
    pointerSize
  );

  lastCastKind = CastKind.Label;
  lastLabelCastType = castToType;
  lastLabelCastSize = pointerSize;
  recentLabelCasts.get(gameName)?.unshift(castToType);
}

async function getStackOffset(line: string): Promise<number | undefined> {
  const matches = [...line.matchAll(stackOffsetRegex)];
  if (matches.length == 1) {
    return parseInt(matches[0][1].toString());
  }
  await vscode.window.showErrorMessage("Couldn't determine stack offset");
  return undefined;
}

async function applyStackCast(
  editor: vscode.TextEditor,
  funcName: string,
  stackOffset: number,
  castToType: string
) {
  const configDir = await getDecompilerConfigDirectory(editor.document.uri);
  if (configDir === undefined) {
    return;
  }
  const filePath = join(configDir, "stack_structures.jsonc");

  const json: any = parse(readFileSync(filePath).toString());
  // Add our new entry
  if (funcName in json) {
    json[funcName].push([stackOffset, castToType]);
  } else {
    json[funcName] = [[stackOffset, castToType]];
  }

  writeFileSync(filePath, stringify(json, null, 2));
}

async function stackCastSelection() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || !validActiveFile(editor)) {
    return;
  }

  // Get the relevant function/method name
  const funcName = await getFuncNameFromSelection(
    editor.document,
    editor.selection
  );
  if (funcName === undefined) {
    return;
  }

  // Get the stack index
  const stackOffset = await getStackOffset(
    editor.document.lineAt(editor.selection.start.line).text
  );
  if (stackOffset === undefined) {
    return;
  }

  // Get what we should cast to
  const gameName = determineGameFromPath(editor.document.uri);
  await initTypeCastSuggestions(gameName);
  if (gameName === undefined) {
    await vscode.window.showErrorMessage("Couldn't determine game version");
    return;
  }

  const items = generateCastSelectionItems(
    typeCastSuggestions.get(gameName),
    recentStackCasts.get(gameName)
  );
  let castToType;
  if (items.length > 0) {
    castToType = (
      await vscode.window.showQuickPick(items, {
        title: "Cast to Type?",
      })
    )?.label;
  } else {
    castToType = await vscode.window.showInputBox({
      title: "Cast to Type?",
    });
  }

  if (castToType === undefined || castToType.trim() === "") {
    await vscode.window.showErrorMessage("Can't cast if no type is provided");
    return;
  }

  // Finally, do the cast!
  await applyStackCast(editor, funcName, stackOffset, castToType.trim());

  lastCastKind = CastKind.Stack;
  lastStackCastType = castToType;
  recentStackCasts.get(gameName)?.unshift(castToType);
}

function getRegisters(
  document: vscode.TextDocument,
  selection: vscode.Selection
): string[] {
  const regSet = new Set<string>();
  for (let i = selection.start.line; i <= selection.end.line; i++) {
    const line = document.lineAt(i).text;
    const regs = [...line.matchAll(registerRegex)];
    regs.forEach((regMatch) => regSet.add(regMatch.toString()));
  }
  return Array.from(regSet).sort();
}

async function applyTypeCast(
  editor: vscode.TextEditor,
  funcName: string,
  castContext: CastContext,
  registerSelection: string,
  castToType: string
) {
  const configDir = await getDecompilerConfigDirectory(editor.document.uri);
  if (configDir === undefined) {
    return;
  }
  const filePath = join(configDir, "type_casts.jsonc");

  const json: any = parse(readFileSync(filePath).toString());
  // Add our new entry
  if (funcName in json) {
    if (castContext.endOp === undefined) {
      json[funcName].push([castContext.startOp, registerSelection, castToType]);
    } else {
      json[funcName].push([
        [castContext.startOp, castContext.endOp],
        registerSelection,
        castToType,
      ]);
    }
  } else {
    if (castContext.endOp === undefined) {
      json[funcName] = [[castContext.startOp, registerSelection, castToType]];
    } else {
      json[funcName] = [
        [
          [castContext.startOp, castContext.endOp],
          registerSelection,
          castToType,
        ],
      ];
    }
  }

  writeFileSync(filePath, stringify(json, null, 2));
}

async function typeCastSelection() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || !validActiveFile(editor)) {
    return;
  }

  // Determine the range of the selection
  const startOpNum = await getOpNumber(
    editor.document.lineAt(editor.selection.start.line).text
  );
  if (startOpNum === undefined) {
    return;
  }
  const castContext = new CastContext(startOpNum);
  if (!editor.selection.isSingleLine) {
    const endOpNum = await getOpNumber(
      editor.document.lineAt(editor.selection.end.line).text
    );
    if (endOpNum === undefined) {
      return;
    }
    castContext.endOp = endOpNum + 1;
  }

  // Get the relevant function/method name
  const funcName = await getFuncNameFromSelection(
    editor.document,
    editor.selection
  );
  if (funcName === undefined) {
    return;
  }

  // Get all possible registers in the given range (in this case, just the line)
  const registers = getRegisters(editor.document, editor.selection);
  if (registers.length == 0) {
    await vscode.window.showErrorMessage(
      "Found no registers to cast in that selection"
    );
    return;
  }

  // Get what register should be casted
  const registerSelection = await vscode.window.showQuickPick(registers, {
    title: "Register to Cast?",
  });
  if (registerSelection === undefined) {
    await vscode.window.showErrorMessage(
      "Can't cast if no register is provided"
    );
    return;
  }

  // Get what we should cast to
  const gameName = determineGameFromPath(editor.document.uri);
  await initTypeCastSuggestions(gameName);
  if (gameName === undefined) {
    await vscode.window.showErrorMessage("Couldn't determine game version");
    return;
  }

  const items = generateCastSelectionItems(
    typeCastSuggestions.get(gameName),
    recentTypeCasts.get(gameName)
  );
  let castToType;
  if (items.length > 0) {
    castToType = (
      await vscode.window.showQuickPick(items, {
        title: "Cast to Type?",
      })
    )?.label;
  } else {
    castToType = await vscode.window.showInputBox({
      title: "Cast to Type?",
    });
  }
  if (castToType === undefined || castToType.trim() === "") {
    await vscode.window.showErrorMessage("Can't cast if no type is provided");
    return;
  }

  // Finally, do the cast!
  await applyTypeCast(
    editor,
    funcName,
    castContext,
    registerSelection,
    castToType.trim()
  );

  lastCastKind = CastKind.TypeCast;
  lastTypeCastRegister = registerSelection;
  lastTypeCastType = castToType;
  recentTypeCasts.get(gameName)?.unshift(castToType);
}

// Execute the same cast as last time (same type, same register) just on a different selection
async function repeatLastCast() {
  if (lastCastKind === undefined) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || !validActiveFile(editor)) {
    return;
  }

  if (lastCastKind === CastKind.Label) {
    const objectName = basename(editor.document.fileName).split("_ir2.asm")[0];
    const labelRef = await getLabelReference(
      editor.document.lineAt(editor.selection.start.line).text
    );
    if (labelRef === undefined || lastLabelCastType === undefined) {
      return;
    }
    await applyLabelCast(
      editor,
      objectName,
      labelRef,
      lastLabelCastType,
      lastLabelCastSize
    );
  } else if (lastCastKind === CastKind.Stack) {
    const funcName = await getFuncNameFromSelection(
      editor.document,
      editor.selection
    );
    if (funcName === undefined) {
      return;
    }

    // Get the stack index
    const stackOffset = await getStackOffset(
      editor.document.lineAt(editor.selection.start.line).text
    );
    if (stackOffset === undefined || lastStackCastType === undefined) {
      return;
    }
    await applyStackCast(editor, funcName, stackOffset, lastStackCastType);
  } else if (lastCastKind === CastKind.TypeCast) {
    const funcName = await getFuncNameFromSelection(
      editor.document,
      editor.selection
    );
    if (funcName === undefined) {
      return;
    }
    const startOpNum = await getOpNumber(
      editor.document.lineAt(editor.selection.start.line).text
    );
    if (startOpNum === undefined) {
      return;
    }
    const castContext = new CastContext(startOpNum);
    if (!editor.selection.isSingleLine) {
      const endOpNum = await getOpNumber(
        editor.document.lineAt(editor.selection.end.line).text
      );
      if (endOpNum === undefined) {
        return;
      }
      castContext.endOp = endOpNum + 1;
    }

    if (lastTypeCastRegister === undefined || lastTypeCastType === undefined) {
      return;
    }

    await applyTypeCast(
      editor,
      funcName,
      castContext,
      lastTypeCastRegister,
      lastTypeCastType
    );
  }
}

export async function activateTypeCastTools() {
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.casts.labelCastSelection",
      labelCastSelection
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.casts.stackCastSelection",
      stackCastSelection
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.casts.typeCastSelection",
      typeCastSelection
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.casts.repeatLast",
      repeatLastCast
    )
  );
}
