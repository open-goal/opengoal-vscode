import path = require("path");
import * as vscode from "vscode";
import { getCastFileData } from "../../decomp/utils";
import { getWorkspaceFolderByName } from "../../utils/workspace";

class HintCacheEntry {
  version: number;
  hints: vscode.InlayHint[];

  constructor(version: number, hints: vscode.InlayHint[]) {
    this.version = version;
    this.hints = hints;
  }
}

const opNumRegex = /.*;; \[\s*(\d+)\]/g;
const funcNameRegex = /; \.function (.*).*/g;

async function getOpNumber(line: string): Promise<number | undefined> {
  const matches = [...line.matchAll(opNumRegex)];
  if (matches.length == 1) {
    return parseInt(matches[0][1].toString());
  }
  return undefined;
}

// NOTE - this is not in the LSP because i want to eventually tie commands to the hint
// to either jump to them or remove them (removing them is probably more useful)

// Though, if i end up never doing this, this SHOULD be in the LSP, probably
// The LSP already knows the all-types file used for the file.  But what would probably
// be better is if it knew the location of the config file
//
// The config file points to everything (all-types / configs / etc)
//
// If this was the cast, the LSP could trivially watch over the cast files to provide these hints
export class IRInlayHintsProvider implements vscode.InlayHintsProvider {
  public onDidChangeInlayHintsEvent = new vscode.EventEmitter<void>();
  public onDidChangeInlayHints?: vscode.Event<void>;

  private fileCache = new Map<string, HintCacheEntry>();

  constructor() {
    this.onDidChangeInlayHints = this.onDidChangeInlayHintsEvent.event;

    // Update inlay hints when the file changes
    // NOTE - this may have an edgecase where it doesn't change but the underlying config does!
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId == "opengoal-ir") {
        if (this.fileCache.has(e.document.fileName)) {
          const entry = this.fileCache.get(e.document.fileName);
          // If the version is the same, leave it alone it's up to date
          if (entry?.version !== e.document.version) {
            this.fileCache.delete(e.document.fileName);
          }
        }
        this.onDidChangeInlayHintsEvent.fire();
      }
    });
  }

  public async provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    token: vscode.CancellationToken
  ): Promise<vscode.InlayHint[] | undefined> {
    // Check if the file has already been computed in the cache
    // We store the entire files hints in the cache and just return the ones that the range wants here
    const entry = this.fileCache.get(document.fileName);
    if (entry !== undefined) {
      if (entry?.version !== document.version) {
        const newHints = await this.computeHintsForDocument(document);
        if (newHints !== undefined) {
          this.fileCache.set(document.fileName, {
            version: document.version,
            hints: newHints,
          });
          return newHints;
        }
        return undefined;
      }
      // Return the results
      return entry?.hints;
    } else {
      // Update it!
      const newHints = await this.computeHintsForDocument(document);
      if (newHints !== undefined) {
        this.fileCache.set(document.fileName, {
          version: document.version,
          hints: newHints,
        });
        return newHints;
      }
      return undefined;
    }
  }

  private async getAllPotentialStackValues(
    stackCastData: any,
    stackOffset: number
  ): Promise<string[]> {
    // Consistently sort the values
    const values = [];
    for (const cast of stackCastData) {
      if (cast[0] == stackOffset) {
        values.push(cast[1]);
      }
    }
    return values;
  }

  private async generateStackCastHints(
    stackCastData: any,
    lineNumber: number,
    line: string
  ): Promise<vscode.InlayHint[]> {
    const hints = [];
    // If the line has an op number, we will care about it
    const opNumber = await getOpNumber(line);
    if (opNumber === undefined) {
      return [];
    }

    const handledOffsets: number[] = [];

    for (const cast of stackCastData) {
      const stackOffset = cast[0];
      if (handledOffsets.includes(stackOffset)) {
        continue;
      }
      const indexes = [
        ...line.matchAll(new RegExp(`sp, ${stackOffset}`, "gi")),
      ].map((a) => a.index);
      const hintLabel = await this.getAllPotentialStackValues(
        stackCastData,
        stackOffset
      );
      for (const index of indexes) {
        if (index === undefined) {
          continue;
        }
        const newHint = new vscode.InlayHint(
          new vscode.Position(lineNumber, index + `sp, ${stackOffset}`.length),
          `: ${hintLabel.join(" | ")}`
        );
        newHint.paddingLeft = true;
        newHint.kind = vscode.InlayHintKind.Type;
        newHint.tooltip = `Found in Stack Casts`;
        hints.push(newHint);
      }
      handledOffsets.push(stackOffset);
    }
    return hints;
  }

  private async getAllPotentialLabelValues(
    labelCastData: any,
    labelRef: string
  ): Promise<string[]> {
    // Consistently sort the values
    const values = [];
    for (const cast of labelCastData) {
      if (cast[0] == labelRef) {
        if (cast.length == 3) {
          values.push(`${cast[1]}[${cast[2]}]`);
        } else {
          values.push(cast[1]);
        }
      }
    }
    return values;
  }

  private async generateLabelCastHints(
    labelCastData: any,
    lineNumber: number,
    line: string
  ): Promise<vscode.InlayHint[]> {
    const hints = [];
    // If the line has an op number, we will care about it
    const opNumber = await getOpNumber(line);
    if (opNumber === undefined) {
      return [];
    }

    const handledRefs: string[] = [];

    for (const cast of labelCastData) {
      const labelRef = cast[0];
      if (handledRefs.includes(labelRef)) {
        continue;
      }
      const indexes = [...line.matchAll(new RegExp(labelRef, "gi"))].map(
        (a) => a.index
      );
      const hintLabel = await this.getAllPotentialLabelValues(
        labelCastData,
        labelRef
      );
      for (const index of indexes) {
        if (index === undefined) {
          continue;
        }
        const newHint = new vscode.InlayHint(
          new vscode.Position(lineNumber, index + `L${labelRef}`.length),
          `: ${hintLabel.join(" | ")}`
        );
        newHint.paddingLeft = true;
        newHint.kind = vscode.InlayHintKind.Type;
        newHint.tooltip = `Found in Label Casts`;
        hints.push(newHint);
      }
      handledRefs.push(labelRef);
    }
    return hints;
  }

  private async getAllPotentialTypeValues(
    typeCastData: any,
    opNumber: number,
    register: string
  ): Promise<string[]> {
    // Consistently sort the values
    const values = [];
    for (const cast of typeCastData) {
      if (cast[0] instanceof Array) {
        if (
          register == cast[1] &&
          opNumber >= cast[0][0] &&
          opNumber < cast[0][1]
        ) {
          values.push(cast[2]);
        }
      } else if (register == cast[1] && cast[0] == opNumber) {
        values.push(cast[2]);
      }
    }
    return values;
  }

  private async generateTypeCastHints(
    typeCastData: any,
    lineNumber: number,
    line: string
  ): Promise<vscode.InlayHint[]> {
    const hints = [];
    // If the line has an op number, we will care about it
    const opNumber = await getOpNumber(line);
    if (opNumber === undefined) {
      return [];
    }

    const handledRegisters: string[] = [];

    for (const cast of typeCastData) {
      let makeHint = false;
      const register = cast[1];
      if (cast[0] instanceof Array) {
        if (opNumber >= cast[0][0] && opNumber < cast[0][1]) {
          makeHint = true;
        }
      } else if (cast[0] == opNumber) {
        makeHint = true;
      }

      if (makeHint) {
        if (handledRegisters.includes(register)) {
          continue;
        }
        const indexes = [...line.matchAll(new RegExp(register, "gi"))].map(
          (a) => a.index
        );
        const hintLabel = await this.getAllPotentialTypeValues(
          typeCastData,
          opNumber,
          register
        );
        for (const index of indexes) {
          if (index === undefined) {
            continue;
          }
          const newHint = new vscode.InlayHint(
            new vscode.Position(lineNumber, index + register.length),
            `: ${hintLabel.join(" | ")}`
          );
          newHint.paddingLeft = true;
          newHint.kind = vscode.InlayHintKind.Type;
          newHint.tooltip = `Found in Type Casts`;
          hints.push(newHint);
        }
        handledRegisters.push(register);
      }
    }
    return hints;
  }

  private async computeHintsForDocument(
    document: vscode.TextDocument
  ): Promise<vscode.InlayHint[] | undefined> {
    const projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return undefined;
    }

    const labelCastData = getCastFileData(
      projectRoot,
      document,
      "label_types.jsonc"
    );

    const stackCastData = getCastFileData(
      projectRoot,
      document,
      "stack_structures.jsonc"
    );

    const typeCastData = getCastFileData(
      projectRoot,
      document,
      "type_casts.jsonc"
    );

    let funcName = undefined;
    let hints: vscode.InlayHint[] = [];
    const fileName = path.basename(document.fileName).split("_ir2.asm")[0];
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      // Label casts are file-level, so the func name doesn't matter
      if (labelCastData !== undefined && fileName in labelCastData) {
        hints = hints.concat(
          await this.generateLabelCastHints(labelCastData[fileName], i, line)
        );
      }

      // See if this is a new function
      const matches = [...line.matchAll(funcNameRegex)];
      if (matches.length == 1) {
        funcName = matches[0][1].toString();
      }

      if (funcName === undefined) {
        continue;
      }

      // Collect any potential hints for this line
      if (typeCastData !== undefined && funcName in typeCastData) {
        hints = hints.concat(
          await this.generateTypeCastHints(typeCastData[funcName], i, line)
        );
      }
      if (stackCastData !== undefined && funcName in stackCastData) {
        hints = hints.concat(
          await this.generateStackCastHints(stackCastData[funcName], i, line)
        );
      }
    }
    return hints;
  }
}
