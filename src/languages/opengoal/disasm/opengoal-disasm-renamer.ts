import { stringify } from "comment-json";
import { writeFileSync } from "fs";
import { join } from "path";
import * as vscode from "vscode";
import {
  getCastFileData,
  getDecompilerConfigDirectory,
} from "../../../utils/decomp-tools";
import { getWorkspaceFolderByName } from "../../../utils/workspace";

export class OpenGOALDisasmRenameProvider implements vscode.RenameProvider {
  public async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken
  ): Promise<vscode.WorkspaceEdit | undefined> {
    const symbolRange = document.getWordRangeAtPosition(position, /[\w\-.]+/g);
    if (symbolRange === undefined) {
      return;
    }
    const symbol = document.getText(symbolRange);

    // TODO - likely doesn't work on states!

    // TODO - detect if its method/function args in a better way thatn just if it's on
    // the same line as a defun/defmethod
    const line = document.lineAt(position.line).text;
    const isArgument = line.includes("defun") || line.includes("defmethod");
    // If it's an argument, we have to figure out the index
    let argumentIndex = undefined;
    let argumentCount = undefined;
    if (isArgument) {
      const matches = [...line.matchAll(/(\([^\s(]*\s[^\s)]*\))/g)];
      if (matches.length == 0) {
        return;
      }
      let tempIdx = 0;
      for (const match of matches[0]) {
        const [argName, argType] = match
          .toString()
          .replace("(", "")
          .replace(")", "")
          .split(" ");
        if (argName === symbol) {
          argumentIndex = tempIdx;
          argumentCount = matches.length;
          break;
        }
        tempIdx++;
      }
      if (argumentIndex === undefined || argumentCount === undefined) {
        return;
      }
    }

    // Get the function this is related to (walk back until a defun/defmethod is found)
    // TODO - probably could eventually replace this with an LSP integration eventually
    // methods are annoying because in cast files they are referred to by the method id, not their name
    let funcName = undefined;
    for (let i = position.line; i > 0; i--) {
      const currLine = document.lineAt(i).text;
      const matches = [
        ...currLine.matchAll(/(?:defun(?:-debug)?|defmethod)\s+([^\s]*)/g),
      ];
      if (matches.length == 1) {
        // Functions are easy
        if (currLine.includes("defun")) {
          funcName = matches[0][1].toString();
          break;
        } else {
          // methods are more difficult, for now we walk back until we find
          // an empty line, then grab the info from the line after that
          let prevLineIdx = i - 1;
          while (
            prevLineIdx > 0 &&
            document.lineAt(prevLineIdx).text.trim() !== ""
          ) {
            prevLineIdx--;
          }
          const defmethodLine = document.lineAt(prevLineIdx + 1).text;
          const methodMatches = [
            ...defmethodLine.matchAll(
              /;; definition for method (\d+) of type (.*)/g
            ),
          ];
          if (methodMatches.length == 1) {
            funcName = `(method ${methodMatches[0][1]} ${methodMatches[0][2]})`;
          }
          break;
        }
      }
    }
    if (funcName === undefined) {
      return;
    }

    // Update the var-names file
    const projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return;
    }

    const varNameData = getCastFileData(
      projectRoot,
      document,
      "var_names.jsonc"
    );
    if (varNameData === undefined) {
      return;
    }

    if (!(funcName in varNameData)) {
      varNameData[funcName] = {};
    }
    if (isArgument) {
      if (argumentIndex === undefined || argumentCount === undefined) {
        return;
      }
      if ("args" in varNameData[funcName]) {
        // We assume that all slots are filled up already, as this is required
        varNameData[funcName].args[argumentIndex] = newName;
      } else {
        // Otherwise, we initialize it properly
        // TODO - supporting `null` here would be nice
        varNameData[funcName].args = [];
        for (let i = 0; i < argumentCount; i++) {
          if (i == argumentIndex) {
            varNameData[funcName].args[i] = newName;
          } else {
            varNameData[funcName].args[i] = `arg${i}`;
          }
        }
      }
    } else {
      // if "vars" is in
      if ("vars" in varNameData[funcName]) {
        // Check to see if the current symbol has already been renamed
        let internalVar = undefined;
        for (const [key, value] of Object.entries(varNameData[funcName].vars)) {
          if (value === symbol) {
            internalVar = key;
            break;
          }
        }
        if (internalVar !== undefined) {
          varNameData[funcName].vars[internalVar] = newName;
        } else {
          varNameData[funcName].vars[symbol] = newName;
        }
      } else {
        varNameData[funcName]["vars"] = {};
        varNameData[funcName]["vars"][symbol] = newName;
      }
    }

    // Write out cast file change
    const configDir = await getDecompilerConfigDirectory(document.uri);
    if (configDir === undefined) {
      return;
    }
    const filePath = join(configDir, "var_names.jsonc");

    writeFileSync(filePath, stringify(varNameData, null, 2));

    // The actual renaming is done by the decompiler, which happens automatically if
    // auto decompilation is enabled
    //
    // TODO - maybe it should pause here and await the file to be re-decompiled so
    // make it consistent (you don't do another rename) before values have been updated.
    return;
  }
}
