import { indentMode, smartMode, parenMode } from "parinfer";
import * as vscode from "vscode";
import { integer } from "vscode-languageclient";
import { getConfig, updateOpengoalParinferMode } from "../../config/config";
import { getEditorRange } from "../../utils/editor-utils";

// TODO:
// - iron out some quirks around undoing
// - tab stops
// - highlight errors
// - initial paren mode should also trim empty lines

const opacityDecoration = vscode.window.createTextEditorDecorationType({
  opacity: "0.6",
});

function parinferRangeToVSCodeRange(parenTrail: any) {
  return new vscode.Range(
    parenTrail.lineNo,
    parenTrail.startX,
    parenTrail.lineNo,
    parenTrail.endX,
  );
}

function dimParenTrails(editor: vscode.TextEditor, parenTrails: any) {
  const parenTrailsRanges = parenTrails.map(parinferRangeToVSCodeRange);
  editor.setDecorations(opacityDecoration, parenTrailsRanges);
}

function updateParenTrails(editor: vscode.TextEditor, parenTrails: any) {
  dimParenTrails(editor, parenTrails);
}

export enum ParinferMode {
  DISABLED = "DISABLED",
  INDENT = "INDENT",
  PAREN = "PAREN",
  SMART = "SMART",
}

enum EventQueueItemType {
  TEXT_CHANGED = "TEXT_CHANGED",
  SELECTION_CHANGED = "SELECTION_CHANGED",
}

interface ParinferChangeEntry {
  lineNo: integer;
  x: integer;
  oldText: string;
  newText: string;
}

interface EventQueueItem {
  type: EventQueueItemType;
  text: string;
  cursorLine?: integer;
  cursorX?: integer;
  changes?: ParinferChangeEntry[];
  prevCursorLine?: integer;
  prevCursorX?: integer;
}

interface ParinferOptions {
  cursorLine: integer;
  cursorX: integer;
  prevCursorLine?: integer;
  prevCursorX?: integer;
}

const eventQueue: EventQueueItem[] = [];
const maxEventQueueSize = 10;
let currentParinferMode = ParinferMode.DISABLED;

const parinferStatusItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  0,
);

function updateStatus() {
  switch (currentParinferMode) {
    case ParinferMode.DISABLED:
      parinferStatusItem.text = "$(json) Parinfer Disabled";
      parinferStatusItem.tooltip = "Currently doing nothing! - Change Mode";
      parinferStatusItem.command = "opengoal.parinfer.changeMode";
      break;
    case ParinferMode.SMART:
      parinferStatusItem.text = "$(json) Smart Parinfer";
      parinferStatusItem.tooltip =
        "Automatically runs in Paren or Indent mode - Change Mode";
      parinferStatusItem.command = "opengoal.parinfer.changeMode";
      break;
    case ParinferMode.PAREN:
      parinferStatusItem.text = "$(json) Paren Parinfer";
      parinferStatusItem.tooltip =
        "You handle the parens while parinfer handles indentation! - Change Mode";
      parinferStatusItem.command = "opengoal.parinfer.changeMode";
      break;
    case ParinferMode.INDENT:
      parinferStatusItem.text = "$(json) Parinfer Disabled";
      parinferStatusItem.tooltip =
        "You handle the indentation while parinfer handles the parens! - Change Mode";
      parinferStatusItem.command = "opengoal.parinfer.changeMode";
      break;
    default:
      break;
  }
}

async function changeParinferMode(mode: ParinferMode) {
  currentParinferMode = mode;
  await updateOpengoalParinferMode(mode);
  updateStatus();
}

function cleanUpEventQueue() {
  if (eventQueue.length > maxEventQueueSize) {
    eventQueue.length = maxEventQueueSize;
  }
}

setInterval(cleanUpEventQueue, 5 * 1000);

function applyParinfer(
  editor: vscode.TextEditor,
  text: string,
  options: ParinferOptions,
  mode: ParinferMode,
) {
  // console.log(`Options Before - ${JSON.stringify(options, null, 2)}`);
  let parinferResult: any; // TODO - make a type def for this
  if (mode === ParinferMode.DISABLED) {
    return;
  } else if (mode === ParinferMode.PAREN) {
    parinferResult = parenMode(text, options);
  } else if (mode === ParinferMode.INDENT) {
    parinferResult = indentMode(text, options);
  } else if (mode === ParinferMode.SMART) {
    parinferResult = smartMode(text, options);
  }

  // TODO - clear decorations when text is removed

  if (text === parinferResult.text) {
    updateParenTrails(editor, parinferResult.parenTrails);
    return;
  }

  editor
    .edit(
      (selectedText) => {
        selectedText.replace(getEditorRange(editor), parinferResult.text);
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    )
    .then(function (editWasApplied) {
      if (editWasApplied) {
        // set the new cursor position
        const newCursorPosition = new vscode.Position(
          parinferResult.cursorLine,
          parinferResult.cursorX,
        );
        const nextCursor = new vscode.Selection(
          newCursorPosition,
          newCursorPosition,
        );
        editor.selection = nextCursor;
        updateParenTrails(editor, parinferResult.parenTrails);
      } else {
        // TODO: should we do something here if the edit fails?
      }
    });
}

function processEventQueue() {
  if (
    eventQueue.length === 0 ||
    eventQueue[0].type !== EventQueueItemType.SELECTION_CHANGED
  ) {
    return;
  }

  // TODO - wire this up to an event listener too (what order though!)
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor === undefined) {
    return;
  }

  const selectionEvent = eventQueue[0];
  if (
    selectionEvent.cursorLine === undefined ||
    selectionEvent.cursorX === undefined
  ) {
    return;
  }
  const options: ParinferOptions = {
    cursorLine: selectionEvent.cursorLine,
    cursorX: selectionEvent.cursorX,
  };

  // check the last two events for previous cursor information
  // TODO - not a huge fan of this code -- prevCursor info is only on selectionEvents
  // depending on queue ordering is kinda sketchy though
  if (eventQueue[1] && eventQueue[1].cursorLine !== undefined) {
    options.prevCursorLine = eventQueue[1].cursorLine;
    options.prevCursorX = eventQueue[1].cursorX;
  } else if (eventQueue[2] && eventQueue[2].cursorLine !== undefined) {
    options.prevCursorLine = eventQueue[2].cursorLine;
    options.prevCursorX = eventQueue[2].cursorX;
  }

  // Document change events happen first, then selection change events
  // In otherwords, they should always be in pairs
  applyParinfer(
    activeEditor,
    selectionEvent.text,
    options,
    currentParinferMode,
  );
}

export function onChangeSelection(
  event: vscode.TextEditorSelectionChangeEvent,
) {
  const editor = event.textEditor;

  if (
    editor.document.languageId !== "opengoal" ||
    editor.document.fileName.endsWith("_disasm.gc") ||
    editor.document.fileName.endsWith("_REF.gc")
  ) {
    return;
  }

  const selection = event.selections[0];

  const newQueueEntry: EventQueueItem = {
    type: EventQueueItemType.SELECTION_CHANGED,
    text: editor.document.getText(),
    cursorLine: selection.active.line,
    cursorX: selection.active.character,
  };

  eventQueue.unshift(newQueueEntry);
  processEventQueue();
}

function getTextFromRange(txt: string, range: vscode.Range, length: integer) {
  if (length === 0) return "";

  const firstLine = range.start.line;
  const firstChar = range.start.character;

  const lines = txt.split("\n");
  const line = lines[firstLine];

  return line.substring(firstChar, firstChar + length);
}

function convertChangeObjects(
  oldText: string,
  changeEvent: vscode.TextDocumentContentChangeEvent,
) {
  return {
    lineNo: changeEvent.range.start.line,
    newText: changeEvent.text,
    oldText: getTextFromRange(
      oldText,
      changeEvent.range,
      changeEvent.rangeLength,
    ),
    x: changeEvent.range.start.character,
  };
}

export function onChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
  // drop any events that do not contain document changes
  // (usually the first event to a document)
  if (event.contentChanges && event.contentChanges.length === 0) {
    return;
  }

  if (
    event.document.languageId !== "opengoal" ||
    event.document.fileName.endsWith("_disasm.gc") ||
    event.document.fileName.endsWith("_REF.gc")
  ) {
    return;
  }

  const newQueueEntry: EventQueueItem = {
    type: EventQueueItemType.TEXT_CHANGED,
    text: event.document.getText(),
  };

  // only create a "changes" property if we have a prior event
  if (eventQueue[0] && eventQueue[0].text) {
    const prevText = eventQueue[0].text;
    const convertFn = convertChangeObjects.bind(null, prevText);
    newQueueEntry.changes = event.contentChanges.map(convertFn);
  }

  eventQueue.unshift(newQueueEntry);
}

function showChangeModeMenu() {
  const items: vscode.QuickPickItem[] = [
    {
      label: ParinferMode.DISABLED,
      description: "Disable parinfer",
    },
    {
      label: ParinferMode.SMART,
      description:
        "Parinfer will try it's best to deduce when to run Paren mode and when to run Indent mode",
    },
    {
      label: ParinferMode.PAREN,
      description:
        "Parinfer will handle the indentation, you handle the parens",
    },
    {
      label: ParinferMode.INDENT,
      description:
        "Parinfer will handle the parens, you handle the indentation",
    },
  ];
  void vscode.window
    .showQuickPick(items, { title: "OpenGOAL Change Parinfer Mode" })
    .then((v) => {
      if (v !== undefined) {
        changeParinferMode(v.label as ParinferMode);
      }
    });
}

export function registerParinferCommands(
  context: vscode.ExtensionContext,
): void {
  changeParinferMode(
    (getConfig().opengoalParinferMode as ParinferMode) ?? ParinferMode.DISABLED,
  );
  updateStatus();
  parinferStatusItem.hide(); // TODO - consolidate menu https://github.com/rust-lang/rust-analyzer/blob/9c03aa1ac2e67051db83a85baf3cfee902e4dd84/editors/code/src/ctx.ts#L406
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.parinfer.changeMode",
      showChangeModeMenu,
    ),
  );
}
