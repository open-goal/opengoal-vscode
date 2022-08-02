import { existsSync, readFileSync } from "fs";
import * as vscode from "vscode";
import { getWorkspaceFolderByName } from "../utils/workspace";

class HintCacheEntry {
  version: number;
  hints: vscode.InlayHint[];

  constructor(version: number, hints: vscode.InlayHint[]) {
    this.version = version;
    this.hints = hints;
  }
}

export class InlayHintsProvider implements vscode.InlayHintsProvider {
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
    if (this.fileCache.has(document.fileName)) {
      const entry = this.fileCache.get(document.fileName);
      if (entry?.version !== document.version) {
        // Update it!
      }
      // Return the results
    } else {
      // Update it!
    }

    // Return the results
    return undefined;
  }

  private async computeHintsForDocument(
    document: vscode.TextDocument
  ): Promise<void> {
    const projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return undefined;
    }
    // TODO - prompt for cast dir, assuming jak 2 right now
    const path = vscode.Uri.joinPath(
      projectRoot,
      "decompiler/config/jak2/type_casts.jsonc"
    ).fsPath;
    if (!existsSync(path)) {
      return; // TODO - error
    }

    // TODO - gotta get more files than this
    // TODO - would be performant to cache these files, requires listening to them as well though
    const castData = JSON.parse(readFileSync(path).toString());
    // Approach idea:
    // - pass through the file, when hitting a function line grab any relevant casts from the cast files
    // - flatten, sanitize and sort this data so we can apply it.
  }
}
