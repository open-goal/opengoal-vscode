import { getExtensionContext } from "../context";
import * as vscode from "vscode";
import {
  determineGameFromAllTypes,
  findFileInGoalSrc,
  GameName,
  updateFileBeforeDecomp,
} from "../utils/file-utils";
import { getWorkspaceFolderByName } from "../utils/workspace";
import { getFuncNameFromPosition } from "../languages/ir2/ir2-utils";
import {
  ArgumentMeta,
  getArgumentsInSignature,
  getSymbolsArgumentInfo,
} from "../languages/opengoal/opengoal-tools";
import { bulkUpdateVarCasts } from "./utils";

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
      },
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
      `;; +++${fileName}:${blockName}\n${content}\n;; ---${fileName}:${blockName}`,
    );
  });

  // Go and place the block in the file
  const game = determineGameFromAllTypes(editor.document.uri);
  const projectRoot = getWorkspaceFolderByName("jak-project");
  if (projectRoot === undefined) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'jak-project' workspace folder",
    );
    return undefined;
  }

  let gameName = "jak1";
  if (game === GameName.Jak2) {
    gameName = "jak2";
  } else if (game === GameName.Jak3) {
    gameName = "jak3";
  }

  const gsrcPath = await findFileInGoalSrc(projectRoot, gameName, fileName);
  if (gsrcPath === undefined) {
    return;
  }
  // Otherwise, let's update it...
  await updateFileBeforeDecomp(
    gsrcPath,
    `;; +++${blockName}\n${blockContent}\n;; ---${blockName}`,
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
    16,
  )}\n`;
  clipboardVal += `  :size-assert         #x${parseInt(
    flags.slice(-4),
    16,
  ).toString(16)} ;; ${parseInt(flags.slice(-4), 16)}\n`;
  clipboardVal += `  :flag-assert         #x${parseInt(
    methodCount.replace("0x", ""),
    16,
  ).toString(16)}${flags}`;

  vscode.env.clipboard.writeText(clipboardVal);
  vscode.window.showInformationMessage(
    "OpenGOAL - Type Flags Copied to Clipboard!",
  );
  return;
}

async function genTypeFields() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return;
  }

  const content = editor.document.getText(editor.selection);
  const lines = content.split("\n");

  const structureTypeSelection = await vscode.window.showQuickPick(
    ["basic", "structure"],
    {
      title: "Structure Type?",
    },
  );
  if (structureTypeSelection === undefined) {
    return;
  }
  const isBasic = structureTypeSelection === "basic";

  const fields: any[] = [];
  // Loop through all lines
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    // Loop until we find a line with the a field name:
    // - `..."~2Tlos:...`
    if (line.includes('"~2T') || line.includes('"~1T')) {
      // Get the field name
      let fieldName = "";
      let arraySize = 0;
      const fieldString = line.split(/"~\dT/g)[1];
      if (fieldString.includes("[")) {
        fieldName = fieldString.split("[")[0];
        arraySize = parseInt(fieldString.split("[")[1].split("]")[0]);
      } else {
        fieldName = fieldString.split(":")[0];
      }
      let skipLine = false;
      for (const field of fields) {
        if (field.name === fieldName) {
          skipLine = true;
          break;
        }
      }
      if (skipLine) {
        i++;
        continue;
      }
      let formatString = "";
      // See if the line also has the type name
      let typeName = "UNKNOWN";
      let isStructure = false;
      if (line.includes(": #<")) {
        typeName = line.split(": #<")[1].split(" @")[0];
        isStructure = true;
      } else if (arraySize === 0) {
        formatString = fieldString.split(": ")[1].split("~%")[0].trim();
      }
      // Iterate until we find the offset, a bit fragile but look for the
      // next line with `gp` in it
      // - daddiu a2, gp, 988
      // - lwu a2, 1136(gp)
      let offset = 0;
      let loadInstr = "";
      while (i < lines.length) {
        line = lines[i];
        if (line.includes("gp")) {
          // Get the offset, adjust it if it's a basic type
          const matches = [...line.split(";;")[0].matchAll(/\s+(\d+)/g)];
          if (matches.length == 1) {
            offset = parseInt(matches[0][1].toString().trim());
            if (line.includes("daddiu")) {
              loadInstr = "daddiu";
            } else {
              loadInstr = line.trim().split(" ")[0];
            }
          } else if (line.includes("r0")) {
            offset = 0;
            if (line.includes("daddiu")) {
              loadInstr = "daddiu";
            } else {
              loadInstr = line.trim().split(" ")[0];
            }
          } else {
            return;
          }
          if (isBasic) {
            offset += 4;
          }
          break;
        }
        i++;
      }
      // TODO - doesn't support inline-arrays/pointers yet
      // Figure out the type name if we havn't already from the little information we have
      if (typeName === "UNKNOWN") {
        if (fieldName.includes("time") && loadInstr === "ld") {
          typeName = "time-frame";
        } else if (fieldName.includes("angle") && loadInstr === "lwc1") {
          typeName = "degrees";
        } else if (fieldName.includes("sound-id") && loadInstr === "ld") {
          typeName = "sound-id";
        } else if (formatString === "~f" && loadInstr === "lwc1") {
          typeName = "float";
        } else if (formatString === "~A" && loadInstr === "lwu") {
          typeName = "symbol";
        } else if (formatString === "~D") {
          if (loadInstr === "lw") {
            typeName = "int32";
          } else if (loadInstr === "lwu") {
            typeName = "uint32";
          } else if (loadInstr === "ld") {
            typeName = "int64";
          } else if (loadInstr === "lbu") {
            typeName = "uint8";
          } else if (loadInstr === "lb") {
            typeName = "int8";
          } else if (loadInstr === "lh") {
            typeName = "int16";
          } else if (loadInstr === "lhu") {
            typeName = "uint16";
          }
        }
      }
      // Construct the field definition
      fields.push({
        name: fieldName,
        type: typeName,
        offset: offset,
        isStructure: isStructure,
        arraySize: arraySize,
        annotation: "",
      });
    }

    i++;
  }

  // Make the output nice, find the maximum size of each so we can padEnd with spaces
  let largestName = 0;
  let largestTypeNameSection = 0;
  for (let f = 0; f < fields.length; f++) {
    const field = fields[f];
    // Check if the field should be inlined
    // TODO - edge-case for the last field (don't know the full size here)
    if (field.arraySize === 0 && field.isStructure && f + 1 < fields.length) {
      if (field.offset + 4 !== fields[f + 1].offset) {
        // NOTE - this can have false positives without knowing the true size of the struct
        field.type += " :inline";
      }
    }
    if (field.arraySize !== 0) {
      field.type += ` ${field.arraySize}`;
      if (field.offset + 4 !== fields[f + 1].offset) {
        field.annotation = ` ;; elt size: ${
          (fields[f + 1].offset - field.offset) / field.arraySize
        }`;
      }
    }

    if (field.name.length > largestName) {
      largestName = field.name.length;
    }
    if (field.type.length > largestTypeNameSection) {
      largestTypeNameSection = field.type.length;
    }
  }

  // Finally, construct the final output
  let clipboardVal = "";
  for (const field of fields) {
    let fieldString = `    (${field.name.padEnd(largestName, " ")} `;
    fieldString += `${field.type.padEnd(largestTypeNameSection, " ")} `;
    fieldString += `:offset-assert ${field.offset.toString()})${
      field.annotation
    }`;
    clipboardVal += `${fieldString}\n`;
  }

  vscode.env.clipboard.writeText(`  (\n${clipboardVal}  )`);

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
    if (line.includes(`(deftype ${parentType} `)) {
      foundType = true;
    }
    if (foundType && line.includes("method-count-assert")) {
      parentTypeMethodCount = parseInt(
        line.split("method-count-assert")[1].trim(),
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

async function applyDecompilerSuggestions() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return;
  }

  editor.edit((selectedText) => {
    const content = editor.document.getText(editor.selection);
    const result = content.replace(
      /\(define-extern (\S+) (\S+)\) ;; (.+)/g,
      "(define-extern $1 $3)",
    );
    selectedText.replace(editor.selection, result);
  });
}

let originalDocumentForRename: vscode.TextDocument | undefined = undefined;
let currentRenameWindow: vscode.TextEditor | undefined = undefined;
let currentRenameLines: string[] = [];
let currentRenameFunctionName: string | undefined = undefined;
let currentRenameArgMeta: ArgumentMeta | undefined = undefined;
let currentRenameFileVersion = 0;

async function batchRenameUnnamedVars() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return;
  }
  const currentSelection = editor.document.getText(editor.selection);

  // We can determine the function in a more consistent way here, that will also allow
  // for renaming anon-functions / states / etc
  const funcName = await getFuncNameFromPosition(
    editor.document,
    editor.selection.active,
  );
  if (funcName === undefined) {
    return;
  }
  currentRenameFunctionName = funcName;
  currentRenameArgMeta = {
    index: 0,
    totalCount: getArgumentsInSignature(currentSelection.split("\n")[0]).length,
    isMethod: currentSelection.split("\n")[0].includes("defmethod"),
  };

  const unnamedVarRegex =
    /(?:(?:arg\d+)|(?:f\d+|at|v[0-1]|a[0-3]|t[0-9]|s[0-7]|k[0-1]|gp|sp|sv|fp|ra)-\d+)/g;

  const vars = new Set(
    [...currentSelection.matchAll(unnamedVarRegex)].map((match) => match[0]),
  );

  currentRenameLines = [];
  currentRenameLines.push(`Renaming Vars in - ${funcName}:`);
  for (const variable of vars) {
    currentRenameLines.push(`${variable} => `);
  }

  originalDocumentForRename = editor.document;
  currentRenameFileVersion++;
  currentRenameWindow = await vscode.window.showTextDocument(
    vscode.Uri.from({
      scheme: "opengoalBatchRename",
      path: "/opengoalBatchRename",
    }),
    { preview: false, viewColumn: vscode.ViewColumn.Beside },
  );
}

async function processOpengoalBatchRename() {
  if (
    originalDocumentForRename === undefined ||
    currentRenameFunctionName === undefined ||
    currentRenameArgMeta === undefined
  ) {
    return;
  }

  const renameMap: Record<string, string> = {};

  for (let i = 0; i < currentRenameLines.length; i++) {
    const tokens = currentRenameLines[i].split("=>");
    if (tokens.length !== 2) {
      continue;
    }
    const oldName = tokens[0].trim();
    const newName = tokens[1].trim();
    renameMap[oldName] = newName;
  }

  await bulkUpdateVarCasts(
    originalDocumentForRename,
    currentRenameFunctionName,
    currentRenameArgMeta,
    renameMap,
  );
  await vscode.commands.executeCommand(
    "workbench.action.revertAndCloseActiveEditor",
  );
}

export async function activateMiscDecompTools() {
  const emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  vscode.workspace.registerFileSystemProvider("opengoalBatchRename", {
    createDirectory() {},
    delete() {},
    onDidChangeFile: emitter.event,
    readDirectory() {
      return [];
    },
    readFile() {
      return new TextEncoder().encode(currentRenameLines.join("\n"));
    },
    rename() {},
    stat() {
      return { ctime: 0, mtime: currentRenameFileVersion, size: 0, type: 0 };
    },
    watch(uri) {
      return new vscode.Disposable(() => {});
    },
    writeFile(uri, content) {
      currentRenameLines = new TextDecoder().decode(content).split("\n");
      processOpengoalBatchRename();
      currentRenameFileVersion++;
    },
  });

  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.addToOffsets",
      addToOffsets,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.preserveBlock",
      preserveBlock,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.convertHexToDec",
      convertHexToDec,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.convertDecToHex",
      convertDecToHex,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.generateTypeFlags",
      generateTypeFlags,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.genTypeFields",
      genTypeFields,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.genMethodStubs",
      genMethodStubs,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.applyDecompilerSuggestions",
      applyDecompilerSuggestions,
    ),
  );
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.misc.batchRenameUnnamedVars",
      batchRenameUnnamedVars,
    ),
  );
}
