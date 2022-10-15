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
}
