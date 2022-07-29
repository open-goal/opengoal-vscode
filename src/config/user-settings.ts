import * as vscode from "vscode";

// Settings defined in `configurationDefaults` are not merged with user settings
// user settings win and replace them.
//
// There are some settings that can't be defined per language, such as overriding icons
// as file name and extension associations supersede language id (by design unfortunately)
//
// Similarly, when making a language it's nice to add color customization without forcing the user
// to use a dedicated theme
// But if the user defines ANY textmate grammar overrides, these once again take precedence.
//
// Therefore, we gotta merge them ourselves

const opengoalVSIconAssocs = [
  {
    extensions: ["gs", "gp"],
    language: "opengoal-goos",
  },
  {
    extensions: ["gc", "gd"],
    language: "opengoal",
  },
  {
    extensions: ["asm"],
    language: "opengoal-ir",
  },
];

export async function setVSIconAssociations() {
  const userConfig = vscode.workspace.getConfiguration();
  // - https://github.com/vscode-icons/vscode-icons/issues/1363
  // - NOTE this may break situations where a file type is being handled by another extension

  let currentIconAssociations: any = userConfig.get(
    "vsicons.associations.files"
  );
  if (currentIconAssociations === undefined) {
    currentIconAssociations = opengoalVSIconAssocs;
  } else {
    for (let i = 0; i < opengoalVSIconAssocs.length; i++) {
      const assoc = opengoalVSIconAssocs[i];
      // Don't add duplicates, update entries if the user has modified it
      let unique = true;
      for (const existingAssoc of currentIconAssociations) {
        if (
          "language" in existingAssoc &&
          existingAssoc.language === assoc.language
        ) {
          currentIconAssociations[i] = assoc;
          unique = false;
          break;
        }
      }
      if (unique) {
        currentIconAssociations.push(assoc);
      }
    }
  }
  await userConfig.update(
    "vsicons.associations.files",
    currentIconAssociations,
    vscode.ConfigurationTarget.Global
  );
}

const opengoalTextMateRules = [
  {
    name: "OpenGOAL Globals",
    scope: ["entity.global.opengoal"],
    settings: {
      foreground: "#36f9f6",
      fontStyle: "bold",
    },
  },
  {
    name: "OpenGOAL Storage",
    scope: ["storage.control.opengoal"],
    settings: {
      foreground: "#36f9f6",
      fontStyle: "italic",
    },
  },
  {
    name: "OpenGOAL Macros, Quoted",
    scope: ["meta.quoted-expression.opengoal"],
    settings: {
      fontStyle: "italic",
    },
  },
  {
    name: "OpenGOAL Symbols",
    scope: ["meta.symbol.opengoal"],
    settings: {
      foreground: "#ff7edbff",
    },
  },
  {
    name: "OpenGOAL-IR TypeAnalysis",
    scope: "opengoal.ir.typeanalysis",
    settings: {
      foreground: "#fe4450E6",
    },
  },
  {
    name: "OpenGOAL-IR Error",
    scope: "opengoal.ir.error",
    settings: {
      foreground: "#fe4450E6",
    },
  },
  {
    name: "OpenGOAL-IR Warn",
    scope: "opengoal.ir.warn",
    settings: {
      foreground: "#feeb44e6",
    },
  },
  {
    name: "OpenGOAL-IR Op Number",
    scope: "opengoal.ir.op-num",
    settings: {
      foreground: "#EC407A",
      fontStyle: "bold",
    },
  },
  {
    name: "OpenGOAL-IR Reg-A0",
    scope: "variable.language.opengoal.ir.regs.a0",
    settings: {
      foreground: "#EF9A9A",
    },
  },
  {
    name: "OpenGOAL-IR Reg-A1",
    scope: "variable.language.opengoal.ir.regs.a1",
    settings: {
      foreground: "#F48FB1",
    },
  },
  {
    name: "OpenGOAL-IR Reg-A2",
    scope: "variable.language.opengoal.ir.regs.a2",
    settings: {
      foreground: "#CE93D8",
    },
  },
  {
    name: "OpenGOAL-IR Reg-A3",
    scope: "variable.language.opengoal.ir.regs.a3",
    settings: {
      foreground: "#90CAF9",
    },
  },
  {
    name: "OpenGOAL-IR Reg-T0",
    scope: "variable.language.opengoal.ir.regs.t0",
    settings: {
      foreground: "#80DEEA",
    },
  },
  {
    name: "OpenGOAL-IR Reg-T1",
    scope: "variable.language.opengoal.ir.regs.t1",
    settings: {
      foreground: "#80CBC4",
    },
  },
  {
    name: "OpenGOAL-IR Reg-T2",
    scope: "variable.language.opengoal.ir.regs.t2",
    settings: {
      foreground: "#A5D6A7",
    },
  },
  {
    name: "OpenGOAL-IR Reg-T3",
    scope: "variable.language.opengoal.ir.regs.t3",
    settings: {
      foreground: "#E6EE9C",
    },
  },
  {
    name: "OpenGOAL-IR Reg-Float",
    scope: "variable.language.opengoal.ir.regs.float",
    settings: {
      foreground: "#BCAAA4",
    },
  },
  {
    name: "OpenGOAL-IR Reg-V0-Return",
    scope: "variable.language.opengoal.ir.regs.return",
    settings: {
      foreground: "#FF9100",
    },
  },
  {
    name: "OpenGOAL-IR Reg-SP",
    scope: "variable.language.opengoal.ir.regs.stack",
    settings: {
      foreground: "#76FF03",
    },
  },
  {
    name: "OpenGOAL-IR Reg-General",
    scope: "variable.language.opengoal.ir.regs",
    settings: {
      foreground: "#B0BEC5",
    },
  },
  {
    name: "OpenGOAL-IR Reg-Function",
    scope: "entity.name.function.opengoal.ir.regs.function",
    settings: {
      fontStyle: "bold",
    },
  },
  {
    name: "OpenGOAL-IR Reg-SymbolTable",
    scope: "entity.name.function.opengoal.ir.regs.symbol-table",
    settings: {
      fontStyle: "bold",
    },
  },
  {
    name: "OpenGOAL-IR Function-Call",
    scope: "entity.name.function.opengoal.ir.function.call",
    settings: {
      fontStyle: "bold",
    },
  },
];

// TODO - expose these colors via configuration settings so the user can change them if they want to
export async function setTextmateColors() {
  // https://github.com/microsoft/vscode/issues/66729
  const userConfig = vscode.workspace.getConfiguration();

  const currentTokenColorCustomizations: any = userConfig.get(
    "editor.tokenColorCustomizations"
  );

  if (!("textMateRules" in currentTokenColorCustomizations)) {
    currentTokenColorCustomizations.textMateRules = opengoalTextMateRules;
  }

  const newRules = [];
  for (const rule of currentTokenColorCustomizations.textMateRules) {
    // Remove all the opengoal ones, we'll re-add them ourselves
    let skip = false;
    for (const opengoalRule of opengoalTextMateRules) {
      if ("name" in rule && opengoalRule.name == rule.name) {
        skip = true;
        break;
      }
    }
    if (!skip) {
      newRules.push(rule);
    }
  }
  // Add all opengoal rules
  for (const opengoalRule of opengoalTextMateRules) {
    newRules.push(opengoalRule);
  }

  currentTokenColorCustomizations.textMateRules = newRules;

  await userConfig.update(
    "editor.tokenColorCustomizations",
    currentTokenColorCustomizations,
    vscode.ConfigurationTarget.Global
  );
}
