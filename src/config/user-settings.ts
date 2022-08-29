import * as vscode from "vscode";
import { getMainChannel } from "../context";
import { getConfig } from "./config";

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
  // Throws error if the user doesn't have these settings
  try {
    await userConfig.update(
      "vsicons.associations.files",
      currentIconAssociations,
      vscode.ConfigurationTarget.Global
    );
  } catch (err) {
    getMainChannel().append(
      `Failed to write icon configuration override - ${err}`
    );
  }
}

// Could not use colors because of - https://github.com/Microsoft/vscode/issues/32813
function getTextMateRules() {
  const config = getConfig();
  return [
    {
      name: "OpenGOAL Globals",
      scope: ["entity.global.opengoal", "entity.global.opengoal-ir"],
      settings: {
        foreground: config.colorsGoalGlobals,
        fontStyle: "bold",
      },
    },
    {
      name: "OpenGOAL Storage",
      scope: ["storage.control.opengoal", "storage.control.opengoal-ir"],
      settings: {
        foreground: config.colorsGoalStorageControl,
        fontStyle: "italic",
      },
    },
    {
      name: "OpenGOAL Macros, Quoted",
      scope: [
        "meta.quoted-expression.opengoal",
        "meta.quoted-expression.opengoal-ir",
      ],
      settings: {
        fontStyle: "italic",
      },
    },
    {
      name: "OpenGOAL Symbols",
      scope: ["meta.symbol.opengoal", "meta.symbol.opengoal-ir"],
      settings: {
        foreground: config.colorsGoalSymbols,
      },
    },
    {
      name: "OpenGOAL-IR TypeAnalysis",
      scope: "opengoal.ir.typeanalysis",
      settings: {
        foreground: config.colorsIRTypeAnalysis,
      },
    },
    {
      name: "OpenGOAL-IR Error",
      scope: "opengoal.ir.error",
      settings: {
        foreground: config.colorsIRError,
      },
    },
    {
      name: "OpenGOAL-IR Warn",
      scope: "opengoal.ir.warn",
      settings: {
        foreground: config.colorsIRWarning,
      },
    },
    {
      name: "OpenGOAL-IR Op Number",
      scope: "opengoal.ir.op-num",
      settings: {
        foreground: config.colorsIROpNumber,
        fontStyle: "bold",
      },
    },
    {
      name: "OpenGOAL-IR Reg-A0",
      scope: "variable.language.opengoal.ir.regs.a0",
      settings: {
        foreground: config.colorsIRRegA0,
      },
    },
    {
      name: "OpenGOAL-IR Reg-A1",
      scope: "variable.language.opengoal.ir.regs.a1",
      settings: {
        foreground: config.colorsIRRegA1,
      },
    },
    {
      name: "OpenGOAL-IR Reg-A2",
      scope: "variable.language.opengoal.ir.regs.a2",
      settings: {
        foreground: config.colorsIRRegA2,
      },
    },
    {
      name: "OpenGOAL-IR Reg-A3",
      scope: "variable.language.opengoal.ir.regs.a3",
      settings: {
        foreground: config.colorsIRRegA3,
      },
    },
    {
      name: "OpenGOAL-IR Reg-T0",
      scope: "variable.language.opengoal.ir.regs.t0",
      settings: {
        foreground: config.colorsIRRegT0,
      },
    },
    {
      name: "OpenGOAL-IR Reg-T1",
      scope: "variable.language.opengoal.ir.regs.t1",
      settings: {
        foreground: config.colorsIRRegT1,
      },
    },
    {
      name: "OpenGOAL-IR Reg-T2",
      scope: "variable.language.opengoal.ir.regs.t2",
      settings: {
        foreground: config.colorsIRRegT2,
      },
    },
    {
      name: "OpenGOAL-IR Reg-T3",
      scope: "variable.language.opengoal.ir.regs.t3",
      settings: {
        foreground: config.colorsIRRegT3,
      },
    },
    {
      name: "OpenGOAL-IR Reg-Float",
      scope: "variable.language.opengoal.ir.regs.float",
      settings: {
        foreground: config.colorsIRRegFloat,
      },
    },
    {
      name: "OpenGOAL-IR Reg-V0-Return",
      scope: "variable.language.opengoal.ir.regs.return",
      settings: {
        foreground: config.colorsIRRegReturn,
      },
    },
    {
      name: "OpenGOAL-IR Reg-SP",
      scope: "variable.language.opengoal.ir.regs.stack",
      settings: {
        foreground: config.colorsIRRegStack,
      },
    },
    {
      name: "OpenGOAL-IR Reg-General",
      scope: "variable.language.opengoal.ir.regs",
      settings: {
        foreground: config.colorsIRRegGeneral,
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
      name: "OpenGOAL-IR Reg-SymbolTable",
      scope: "entity.name.function.opengoal.ir.regs.process",
      settings: {
        foreground: config.colorsIRRegProcess,
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
}

// TODO - expose these colors via configuration settings so the user can change them if they want to
export async function setTextmateColors() {
  // https://github.com/microsoft/vscode/issues/66729
  const userConfig = vscode.workspace.getConfiguration();

  const currentTokenColorCustomizations: any = userConfig.get(
    "editor.tokenColorCustomizations"
  );

  const opengoalTextMateRules = getTextMateRules();

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

  // Throws error if the user doesn't have these settings
  try {
    await userConfig.update(
      "editor.tokenColorCustomizations",
      currentTokenColorCustomizations,
      vscode.ConfigurationTarget.Global
    );
  } catch (err) {
    getMainChannel().append(`Failed to write textmate rule override - ${err}`);
  }
}
