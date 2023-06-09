import { Socket } from "net";
import * as path from "path";
import PromiseSocket from "promise-socket";
import * as vscode from "vscode";
import { getConfig } from "../../../config/config";

let jackedIn = false;
let socket: PromiseSocket<Socket> | undefined = undefined;

const nreplStatusItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  0
);

function updateStatus() {
  // TODO - show errors
  if (!jackedIn) {
    nreplStatusItem.text = "$(call-outgoing) nREPL";
    nreplStatusItem.tooltip =
      "Jack-in to a running OpenGOAL nREPL on port 8181";
    nreplStatusItem.command = "opengoal.nrepl.jackin";
  } else {
    nreplStatusItem.text = "$(debug-disconnect) nREPL";
    nreplStatusItem.tooltip =
      "Un-jack from a running OpenGOAL nREPL on port 8181";
    nreplStatusItem.command = "opengoal.nrepl.unjack";
  }
}

export async function jackIn() {
  if (socket !== undefined) {
    jackedIn = true;
    updateStatus();
    return;
  }
  try {
    socket = new PromiseSocket();
    socket.setEncoding("utf8");
    socket.socket.setTimeout(100);
    await socket.connect(8181, "127.0.0.1");
    jackedIn = true;
  } catch (e) {
    console.error(e);
    socket = undefined;
  }
  updateStatus();
}

export async function unJack() {
  if (socket === undefined) {
    jackedIn = false;
    updateStatus();
    return;
  }
  try {
    socket.destroy();
  } catch (e) {
    console.error(e);
  }
  socket = undefined;
  jackedIn = false;
  updateStatus();
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

export function registerNReplCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("opengoal.nrepl.jackin", jackIn),
    vscode.commands.registerCommand("opengoal.nrepl.unjack", unJack)
  );
  updateStatus();
  nreplStatusItem.show();
}

export function nreplOnFileSaveHandler(e: vscode.TextDocument) {
  if (e.languageId !== "opengoal") {
    return;
  }
  // Get the name
  const fileName = path.basename(e.fileName).replace(".gc", "");
  console.log(fileName);
  reloadFile(fileName);
}
