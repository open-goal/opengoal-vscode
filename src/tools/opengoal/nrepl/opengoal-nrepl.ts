import { Socket } from "net";
import * as path from "path";
import PromiseSocket from "promise-socket";
import * as vscode from "vscode";
import { getConfig } from "../../../config/config";
import { updateStatusBar } from "../../../context";
import Parser from "web-tree-sitter";

let jackedIn = false;
let socket: PromiseSocket<Socket> | undefined = undefined;

// TODO - status bar updates for errors and such

export function isJackedIn() {
  return jackedIn;
}

export async function jackIn() {
  if (socket !== undefined) {
    jackedIn = true;
    updateStatusBar(false, false);
    return;
  }
  try {
    socket = new PromiseSocket();
    socket.setEncoding("utf8");
    socket.socket.setTimeout(100);
    const port = getConfig().replPort;
    if (port !== undefined) {
      await socket.connect(port, "127.0.0.1");
      jackedIn = true;
    }
  } catch (e) {
    console.error(e);
    socket = undefined;
  }
  updateStatusBar(false, false);
}

export async function unJack() {
  if (socket === undefined) {
    jackedIn = false;
    updateStatusBar(false, false);
    return;
  }
  try {
    socket.destroy();
  } catch (e) {
    console.error(e);
  }
  socket = undefined;
  jackedIn = false;
  updateStatusBar(false, false);
}

export async function reloadFile(fileName: string) {
  if (!getConfig().reloadFileOnSave) {
    return;
  }
  if (getConfig().autoReplJackIn && socket === undefined) {
    await jackIn();
  }
  if (!jackedIn || socket === undefined) {
    return;
  }
  try {
    // Define your data
    const mlForm = `(ml "${fileName}")`;
    const headerLength = 8;

    // Create a buffer
    const headerBuffer = Buffer.alloc(headerLength);

    // Pack the data into the buffer
    headerBuffer.writeUInt32LE(Buffer.byteLength(mlForm), 0);
    headerBuffer.writeUInt32LE(10, 4);

    const formBuffer = Buffer.from(mlForm, "utf8");

    await socket.writeAll(Buffer.concat([headerBuffer, formBuffer]));
  } catch (e) {
    console.error(e);
  }
}

export async function evalCurrentForm() {
  if (getConfig().autoReplJackIn && socket === undefined) {
    await jackIn();
  }
  if (!jackedIn || socket === undefined) {
    return;
  }
  try {
    // Find the current form
    const currDocument = vscode.window.activeTextEditor?.document;
    const currPosition = vscode.window.activeTextEditor?.selection.start;
    const documentText = currDocument?.getText();
    if (documentText === undefined || currPosition === undefined) {
      return;
    }

    // Parse the document
    await Parser.init();
    const opengoalParser = new Parser();
    const opengoalLang = await Parser.Language.load(
      path.join(__dirname, "tree-sitter-opengoal.wasm"),
    );
    opengoalParser.setLanguage(opengoalLang);
    const tree = opengoalParser.parse(documentText);
    let foundNode = tree.rootNode.descendantForPosition({
      row: currPosition.line,
      column: currPosition.character,
    });

    // Walk back up the tree until we find a `list_lit` node, this is a bit limiting in some ways but is good enough for now
    // this prevents you from sending symbol names to the repl
    while (foundNode.type !== "list_lit" && foundNode.parent) {
      foundNode = foundNode.parent;
    }

    const form = foundNode.text;
    // Define your data
    const headerLength = 8;

    // Create a buffer
    const headerBuffer = Buffer.alloc(headerLength);

    // Pack the data into the buffer
    headerBuffer.writeUInt32LE(Buffer.byteLength(form), 0);
    headerBuffer.writeUInt32LE(10, 4);

    const formBuffer = Buffer.from(form, "utf8");

    await socket.writeAll(Buffer.concat([headerBuffer, formBuffer]));
  } catch (e) {
    console.error(e);
  }
}

export function registerNReplCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.nrepl.jackin", jackIn),
    vscode.commands.registerCommand("opengoal.nrepl.unjack", unJack),
    vscode.commands.registerCommand(
      "opengoal.nrepl.evalCurrentForm",
      evalCurrentForm,
    ),
  );
}

export function nreplOnFileSaveHandler(e: vscode.TextDocument) {
  if (e.languageId !== "opengoal") {
    return;
  }
  // Get the name
  const fileName = path.basename(e.fileName).replace(".gc", "");
  reloadFile(fileName);
}
