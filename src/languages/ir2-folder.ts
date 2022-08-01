import * as vscode from "vscode";

export class IRFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];
    const functionStart = /^; \.function/;
    const functionEnd = /^;; \.endfunction/;
    const label = /L\d+:/;
    const branch = /B\d+:/;

    let currFunctionStart = -1;
    let currLabelStart = -1;
    let currBranchStart = -1;

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      // The start of a new function
      if (functionStart.test(line)) {
        currFunctionStart = i;
      }
      // The end of the current function
      if (functionEnd.test(line)) {
        if (currFunctionStart != -1) {
          // End existing function
          ranges.push(
            new vscode.FoldingRange(
              currFunctionStart,
              i - 1,
              vscode.FoldingRangeKind.Region
            )
          );
        }
      }
      // The start of a label or new section of data
      if (label.test(line)) {
        if (currLabelStart != -1) {
          // End existing label
          ranges.push(
            new vscode.FoldingRange(
              currLabelStart,
              i - 1,
              vscode.FoldingRangeKind.Region
            )
          );
        }
        currLabelStart = i;
      } else if (
        currLabelStart != -1 &&
        (line.trim().startsWith("(") || line.trim().startsWith(";"))
      ) {
        // End existing label
        ranges.push(
          new vscode.FoldingRange(
            currLabelStart,
            i - 1,
            vscode.FoldingRangeKind.Region
          )
        );
        currLabelStart = -1;
      }
      if (branch.test(line)) {
        if (currBranchStart != -1) {
          // End existing function
          ranges.push(
            new vscode.FoldingRange(
              currBranchStart,
              i - 1,
              vscode.FoldingRangeKind.Region
            )
          );
        }
        currBranchStart = i;
      } else if (
        currBranchStart != -1 &&
        (line.trim().startsWith("(") || line.trim().startsWith(";"))
      ) {
        // End existing branch
        ranges.push(
          new vscode.FoldingRange(
            currBranchStart,
            i - 1,
            vscode.FoldingRangeKind.Region
          )
        );
        currBranchStart = -1;
      }
    }

    return ranges;
  }
}
