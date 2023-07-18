import { existsSync } from "fs";
import * as vscode from "vscode";
import {
  getConfig,
  updateEeManPagePath,
  updateVuManPagePath,
} from "../config/config";
import instructions from "../data/decomp/instructions.json";

export async function open_in_pdf(mnemonic: string) {
  const relevant_options: any[] = [];
  instructions.forEach((instr) => {
    if (mnemonic.toLocaleLowerCase() == instr.mnemonic.toLocaleLowerCase()) {
      relevant_options.push(instr);
    }
  });
  if (relevant_options.length <= 0) {
    return;
  }
  let selected_option;
  // If there are multiple, make the user pick one!
  if (relevant_options.length > 1) {
    const items: vscode.QuickPickItem[] = [];
    for (const option of relevant_options) {
      items.push({
        label: `${option.type.toUpperCase()} - ${option.mnemonic}`,
        description: option.description,
      });
    }
    const selection = await vscode.window.showQuickPick(items, {
      title: "Ambiguous Mnemonic",
    });
    if (selection === undefined) {
      return;
    }
    // Figure out which one they picked
    const type = selection.label.toLowerCase().split(" - ")[0];
    const description = selection.description;
    for (const option of relevant_options) {
      if (option.type == type && option.description == description) {
        selected_option = option;
        break;
      }
    }
  } else {
    selected_option = relevant_options[0];
  }
  // Now that we have our one option, open the PDF
  // But first!, if the user hasn't setup the paths, get them to.
  let config = getConfig();
  if (
    selected_option.type == "ee" &&
    (config.eeManPagePath === null ||
      config.eeManPagePath === undefined ||
      !existsSync(vscode.Uri.parse(config.eeManPagePath).fsPath))
  ) {
    const path = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { Manuals: ["pdf"] },
      openLabel: "Use Path",
      title: "Provide Path for EE Man Page",
    });
    if (path === undefined || path.length == 0) {
      return;
    }
    await updateEeManPagePath(path[0].toString());
  } else if (
    selected_option.type == "vu" &&
    (config.vuManPagePath === null ||
      config.vuManPagePath === undefined ||
      !existsSync(vscode.Uri.parse(config.vuManPagePath).fsPath))
  ) {
    const path = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { Manuals: ["pdf"] },
      openLabel: "Use Path",
      title: "Provide Path for VU Man Page",
    });
    if (path === undefined || path.length == 0) {
      return;
    }
    await updateVuManPagePath(path[0].toString());
  }
  config = getConfig();
  // Finally, open the PDF
  if (selected_option.type == "ee") {
    const path = vscode.Uri.parse(
      `${config.eeManPagePath}#page=${selected_option.page}`
    );
    vscode.commands.executeCommand(
      "vscode.openWith",
      path,
      "pdf.opengoal.manpage"
    );
  } else if (selected_option.type == "vu") {
    const path = vscode.Uri.parse(
      `${config.vuManPagePath}#page=${selected_option.page}`
    );
    vscode.commands.executeCommand(
      "vscode.openWith",
      path,
      "pdf.opengoal.manpage"
    );
  }
}
