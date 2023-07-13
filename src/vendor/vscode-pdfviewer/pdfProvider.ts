import * as vscode from "vscode";
import { PdfPreview } from "./pdfPreviewer";

export class PdfCustomProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = "pdf.opengoal.manpage";

  private readonly _previews = new Map<vscode.Uri, PdfPreview>();
  private _activePreview: PdfPreview | undefined;

  constructor(private readonly extensionRoot: vscode.Uri) {}

  public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return { uri, dispose: (): void => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel,
  ): Promise<void> {
    const preview = new PdfPreview(
      this.extensionRoot,
      document.uri,
      webviewEditor,
    );
    this._previews.set(document.uri, preview);
    this.setActivePreview(preview);

    webviewEditor.onDidDispose(() => {
      this._previews.delete(document.uri);
    });

    webviewEditor.onDidChangeViewState(() => {
      if (webviewEditor.active) {
        this.setActivePreview(preview);
      } else if (this._activePreview === preview && !webviewEditor.active) {
        this.setActivePreview(undefined);
      }
    });
  }

  public updatePageIfActive(uri: vscode.Uri, pageNum: number): boolean {
    if (
      this._previews.has(uri) &&
      this._previews.get(uri) == this._activePreview
    ) {
      this._activePreview?.updatePage(pageNum);
      return true;
    }
    return false;
  }

  public get activePreview(): PdfPreview | undefined {
    return this._activePreview;
  }

  private setActivePreview(value: PdfPreview | undefined): void {
    this._activePreview = value;
  }
}
