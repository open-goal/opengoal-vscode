import { execFile } from "child_process";
import * as vscode from "vscode";
import { getExtensionContext } from "../../context";
import * as util from "util";
import { getWorkspaceFolderByName } from "../../utils/workspace";
import { existsSync, readFileSync } from "fs";

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en" class="sl-theme-dark">

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Type Search</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/milligram/1.4.1/milligram.min.css">
    <link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.0.0-beta.83/dist/themes/dark.css" />
    <script type="module"
      src="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.0.0-beta.83/dist/shoelace.js"></script>
    <style>
      .wrap {
        flex-wrap: wrap;
      }

      .mt-2 {
        margin-top: 1.5em;
      }

      .mt-1 {
        margin-top: 1em;
      }

      .mr-1 {
        margin-right: 1em;
      }

      html {
        font-size: 0.75em;
      }

      body {
        color: var(--sl-color-gray-700);
      }

      sl-button::part(label) {
        font-weight: 700;
      }

      h2 {
        color: var(--sl-color-gray-900);
      }

    </style>
  </head>

  <body>
    <script defer>
      const vscode = acquireVsCodeApi();

      function search(evt) {
        let parentName = document.getElementById("parent-name").value;
        let typeSize = parseInt(document.getElementById("type-size").value);
        let methodId = parseInt(document.getElementById("method-id").value);
        let gameName = document.getElementById("game-name").value;

        let fieldNames = [];
        let nameElts = document.querySelectorAll('#field-filters sl-input.field-name');
        for (const elt of nameElts) {
          fieldNames.push(elt.value);
        }

        let fieldOffsets = [];
        let offsetElts = document.querySelectorAll('#field-filters sl-input.field-offset');
        for (const elt of offsetElts) {
          fieldOffsets.push(parseInt(elt.value));
        }

        vscode.postMessage({
          command: 'search',
          parentName: parentName,
          typeSize: typeSize,
          methodId: methodId,
          gameName: gameName,
          fieldNames: fieldNames,
          fieldOffsets: fieldOffsets
        })
      }

      function addField(evt) {
        const row = document.createElement("div");
        row.className = "row wrap";

        const nameColumn = document.createElement("div");
        nameColumn.className = "column column-25";
        const nameField = document.createElement("sl-input");
        nameField.label = "Field Type?";
        nameColumn.appendChild(nameField);

        const offsetColumn = document.createElement("div");
        offsetColumn.className = "column column-25";
        const offsetField = document.createElement("sl-input");
        offsetField.label = "Offset?";
        offsetField.type = "number";
        offsetColumn.appendChild(offsetField);

        row.appendChild(nameColumn);
        row.appendChild(offsetColumn);

        document.getElementById("field-filters").appendChild(row);
      }

      window.addEventListener('message', event => {
        document.getElementById("results").innerHTML = "";
        const message = event.data;
        if (message.command === "search") {
          if (message.data instanceof Array && message.data.length <= 0) {
            const column = document.createElement("div");
            column.className = "column column-20";
            const content = document.createTextNode("No Results");
            column.appendChild(content);
            document.getElementById("results").appendChild(column);
          } else {
            for (const name of message.data) {
              const column = document.createElement("div");
              column.className = "column column-20";
              const content = document.createTextNode(name);
              column.appendChild(content);
              document.getElementById("results").appendChild(column);
            }
          }
        }
      });

      // TODO - implement clear
    </script>
    <div class="container">
      <h2 class="mt-2">General Filters</h2>
      <div class="row">
        <div class="column column-25">
          <sl-input label="Parent Type Name?" id="parent-name"></sl-input>
        </div>
      </div>
      <div class="row">
        <div class="column column-25">
          <sl-input label="Type Size?" id="type-size" type="number"></sl-input>
        </div>
      </div>
      <div class="row">
        <div class="column column-25">
          <sl-input label="Method ID?" id="method-id" type="number"></sl-input>
        </div>
      </div>
      <div class="row mt-1">
        <div class="column column-25">
          <sl-radio-group label="Game?" value="jak2" fieldset id="game-name">
            <sl-radio-button value="jak1">Jak 1</sl-radio-button>
            <sl-radio-button value="jak2">Jak 2</sl-radio-button>
            <sl-radio-button value="jak3">Jak 3</sl-radio-button>
            <sl-radio-button value="jakx">Jak X</sl-radio-button>
          </sl-radio-group>
        </div>
      </div>
      <h2 class="mt-2">Field Type Filters</h2>
      <div id="field-filters">
        <div class="row wrap">
          <div class="column column-25">
            <sl-input label="Field Name?" class="field-name"></sl-input>
          </div>
          <div class="column column-25">
            <sl-input label="Offset?" class="field-offset" type="number"></sl-input>
          </div>
        </div>
      </div>
      <div class="row mt-2">
        <div class="column">
          <sl-button variant="primary" onclick="addField()" class="mr-1">Add Another Field</sl-button>
          <sl-button variant="success" onclick="search()" class="mr-1">Search</sl-button>
          <sl-button variant="warning">Clear</sl-button>
        </div>
      </div>
      <h2 class="mt-2">Results</h2>
      <div class="row wrap" id="results">
        <div class="column column-20">No Results</div>
      </div>
    </div>
  </body>

  </html>
  `;
}

function defaultTypeSearcherPath() {
  const platform = process.platform;
  if (platform == "win32") {
    return "out/build/Release/bin/type_searcher.exe";
  } else {
    return "build/tools/type_searcher";
  }
}

const execFileAsync = util.promisify(execFile);

let projectRoot: vscode.Uri | undefined = undefined;
let currentPanel: vscode.WebviewPanel | undefined = undefined;

async function searchForTypes(message: any): Promise<string[]> {
  if (projectRoot === undefined) {
    projectRoot = getWorkspaceFolderByName("jak-project");
    if (projectRoot === undefined) {
      vscode.window.showErrorMessage(
        "OpenGOAL - Unable to locate 'jak-project' workspace folder"
      );
      return [];
    }
  }
  const typeSearcherPath = vscode.Uri.joinPath(
    projectRoot,
    defaultTypeSearcherPath()
  );
  if (!existsSync(typeSearcherPath.fsPath)) {
    vscode.window.showErrorMessage(
      "OpenGOAL - Unable to locate 'type_searcher' binary"
    );
  }

  const searchFile = vscode.Uri.joinPath(
    projectRoot,
    "search-results.json"
  ).fsPath;

  const args = [`--output-path`, searchFile, "--game", message.gameName];

  if ("parentName" in message && message.parentName !== "") {
    args.push(`--parent`);
    args.push(message.parentName);
  }
  if ("typeSize" in message && message.typeSize !== null) {
    args.push(`--size`);
    args.push(message.typeSize);
  }
  if ("methodId" in message && message.methodId !== null) {
    args.push(`--method_id`);
    args.push(message.methodId);
  }
  if ("fieldNames" in message && message.fieldNames.length > 0) {
    const encodedFields = [];
    for (let i = 0; i < message.fieldNames.length; i++) {
      const fieldName = message.fieldNames[i];
      const fieldOffset = message.fieldOffsets[i];
      if (fieldName === "" || fieldOffset === null) {
        continue;
      }
      encodedFields.push({
        type: fieldName,
        offset: fieldOffset,
      });
    }
    args.push(`--fields`);
    args.push(JSON.stringify(encodedFields));
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      typeSearcherPath.fsPath,
      args,
      {
        encoding: "utf8",
        cwd: projectRoot?.fsPath,
        timeout: 20000,
      }
    );
    // Parse the file
    const result = readFileSync(searchFile, { encoding: "utf-8" });
    return JSON.parse(result);
  } catch (error: any) {
    console.log(error);
    return [`error - ${error}`];
  }
}

async function openPanel() {
  currentPanel = vscode.window.createWebviewPanel(
    "typeSearcher",
    "Type Searcher",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  currentPanel.webview.html = getWebviewContent();

  // Handle messages from the webview
  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === "search") {
        const result = await searchForTypes(message);
        currentPanel?.webview.postMessage({
          command: "search",
          data: result,
        });
      }
    },
    undefined,
    getExtensionContext().subscriptions
  );
}

export async function activateDecompTypeSearcher() {
  // Commands
  getExtensionContext().subscriptions.push(
    vscode.commands.registerCommand(
      "opengoal.decomp.typeSearcher.open",
      openPanel
    )
  );
}
