import { getExtensionContext } from "../context";
import * as vscode from "vscode";
import {
  determineGameFromAllTypes,
  findFileInGoalSrc,
  GameName,
  updateFileBeforeDecomp,
} from "../utils/file-utils";
import { getWorkspaceFolderByName } from "../utils/workspace";

async function addToOffsets() {
  const editor = vscode.window.activeTextEditor;
  if (
    editor === undefined ||
    editor.selection.isEmpty ||
    editor.selection.isSingleLine
  ) {
    return;
  }

  // Get amount to increment
  const incString = await vscode.window.showInputBox({
    title: "Increment By?",
  });
  if (incString === undefined) {
    return;
  }
  const incAmount = parseInt(incString);

  editor.edit((selectedText) => {
    // Get the content of the selection
    const content = editor.document.getText(editor.selection);

    // Increment all values after `:offset` or `:offset-assert`
    const result = content.replace(
      /(?<=offset(?:-assert)?\s+)(\d+)(?=\s+|\))/g,
      (match, key) => {
        console.log(`${match}-${key}`);
        return `${parseInt(key) + incAmount}`;
      }
    );

    selectedText.replace(editor.selection, result);
  });
}

async function preserveBlock() {
  const editor = vscode.window.activeTextEditor;
  if (
    editor === undefined ||
    editor.selection.isEmpty ||
    editor.selection.isSingleLine
  ) {
    return;
  }

  // Ask the user for the file name
  const fileName = await vscode.window.showInputBox({
    title: "File Name?",
  });

  // Attempt to grab the first line's name if it's an `defenum`
  const content = editor.document.getText(editor.selection);
  const matches = [...content.matchAll(/\(defenum\s+([^\s]+)/g)];
  let enumName = undefined;
  if (matches.length == 1) {
    enumName = matches[0][1].toString();
  }

  // Ask the user for the block name
  const blockName = await vscode.window.showInputBox({
    title: "Block Name?",
    value: enumName,
  });

  if (fileName === undefined || blockName === undefined) {
    return;
  }

  let blockContent = "";

  // Wrap the block in `all-types`
  editor.edit((selectedText) => {
    // Get the content of the selection
    const content = editor.document.getText(editor.selection);
    blockContent = content;
    selectedText.replace(
      editor.selection,
      `;; +++${fileName}:${blockName}\n${content}\n;; ---${fileName}:${blockName}`
    );
  });

  // Go and place the block in the file
  const game = determineGameFromAllTypes(editor.document.uri);
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder"
    );
    return undefined;
  }

  let gameName = "jak1";
  if (game === GameName.Jak2) {
    gameName = "jak2";
  }

  const gsrcPath = await findFileInGoalSrc(projectRoot, gameName, fileName);
  if (gsrcPath === undefined) {
    return;
  }
  // Otherwise, let's update it...
  await updateFileBeforeDecomp(
    gsrcPath,
    `;; +++${blockName}\n${blockContent}\n;; ---${blockName}`
  );
}

async function convertHexToDec() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return;
  }

  editor.edit((selectedText) => {
    // Get the content of the selection
    const content = editor.document.getText(editor.selection);

    // Increment all values after `:offset` or `:offset-assert`
    const result = content.replace(/#x([\da-fA-F]+)/g, (match, key) => {
      console.log(`${match}-${key}`);
      return `${parseInt(key, 16)}`;
    });

    selectedText.replace(editor.selection, result);
  });
}

async function convertDecToHex() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return;
  }

  editor.edit((selectedText) => {
    // Get the content of the selection
    const content = editor.document.getText(editor.selection);

    // Increment all values after `:offset` or `:offset-assert`
    const result = content.replace(/ (\d+)/g, (match, key) => {
      console.log(`${match}-${key}`);
      return ` #x${parseInt(key).toString(16)}`;
    });

    selectedText.replace(editor.selection, result);
  });
}

async function generateTypeFlags() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return;
  }

  // Get the content of the selection
  const content = editor.document.getText(editor.selection);

  // Get all lines that start with `.word`, there should only be two!
  const lines = content
    .split("\n")
    .filter((line) => line.trim().startsWith(".word"));
  if (lines.length !== 2) {
    return;
  }
  const flags = lines[0]
    .split(".word ")[1]
    .trim()
    .replace("0x", "")
    .padStart(8, "0");
  const methodCount = lines[1].split(".word ")[1].trim();

  // :method-count-assert 203
  // :size-assert         #x3d4
  // :flag-assert         #xcb036003d4 / #x9 0000 0010
  let clipboardVal = `  :method-count-assert ${parseInt(
    methodCount.replace("0x", ""),
    16
  )}\n`;
  clipboardVal += `  :size-assert         #x${parseInt(
    flags.slice(-4),
    16
  ).toString(16)} ;; ${parseInt(flags.slice(-4), 16)}\n`;
  clipboardVal += `  :flag-assert         #x${parseInt(
    methodCount.replace("0x", ""),
    16
  ).toString(16)}${flags}`;

  vscode.env.clipboard.writeText(clipboardVal);
  vscode.window.showInformationMessage(
    "OpenGOAL - Type Flags Copied to Clipboard!"
  );
  return;
}

async function genMethodStubs() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return;
  }

  const content = editor.document.getText(editor.selection);
  const lines = content.split("\n");

  // Figure out the types, parent -- and method count
  let parentType = "";
  let methodCount = 0;
  let typeName = "";
  for (const line of lines) {
    if (line.includes("deftype")) {
      parentType = line.replace("(deftype", "").split("(")[1].split(")")[0];
      typeName = line.replace("(deftype ", "").split(" ")[0];
    }
    if (line.includes("method-count-assert")) {
      methodCount = parseInt(line.split("method-count-assert")[1].trim());
    }
  }

  // Now, go find the parent type, and figure out it's method count
  const fileContents = editor.document.getText();
  const fileContentsLines = fileContents.split("\n");
  let foundType = false;
  let parentTypeMethodCount = 0;
  for (const line of fileContentsLines) {
    if (line.includes(`(deftype ${parentType}`)) {
      foundType = true;
    }
    if (foundType && line.includes("method-count-assert")) {
      parentTypeMethodCount = parseInt(
        line.split("method-count-assert")[1].trim()
      );
      break;
    }
  }

  // Now put it all together!
  const methodStubs = [];
  for (let i = parentTypeMethodCount; i < methodCount; i++) {
    methodStubs.push(`    (${typeName}-method-${i} () none ${i})`);
  }

  vscode.env.clipboard.writeText(`(:methods\n${methodStubs.join("\n")})`);
  return;
}

export async function activateMiscDecompTools() {
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.addToOffsets",
      addToOffsets
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.preserveBlock",
      preserveBlock
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.convertHexToDec",
      convertHexToDec
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.convertDecToHex",
      convertDecToHex
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.generateTypeFlags",
      generateTypeFlags
    )
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.genMethodStubs",
      genMethodStubs
    )
  );
}
