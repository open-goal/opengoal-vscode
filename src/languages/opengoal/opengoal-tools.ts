import * as vscode from "vscode";

export interface ArgumentMeta {
  index: number;
  totalCount: number;
  isMethod: boolean;
}

export interface ArgumentDefinition {
  name: string;
  type: string;
}

export function getArgumentsInSignature(
  signature: string,
): ArgumentDefinition[] {
  const isSignature =
    signature.includes("defun") ||
    signature.includes("defmethod") ||
    signature.includes("defbehavior");

  if (!isSignature) {
    return [];
  }

  const matches = [...signature.matchAll(/(\([^\s(]*\s[^\s)]*\))/g)];
  if (matches.length == 0) {
    return [];
  }

  const args: ArgumentDefinition[] = [];
  for (const match of matches) {
    const [argName, argType] = match[1]
      .toString()
      .replace("(", "")
      .replace(")", "")
      .split(" ");
    args.push({
      name: argName,
      type: argType,
    });
  }
  return args;
}

// This function can only currently figure out arguments if they are on the same line as
// a defun/defmethod/etc
//
// TODO - look ahead/behind from this line to see if we are in the arg list
// TODO - likely doesn't work on states
export function getSymbolsArgumentInfo(
  line: string,
  symbol: string,
): ArgumentMeta | undefined {
  // TODO - 'new' method handling
  // If it's an argument, we have to figure out the index
  let argumentIndex = undefined;
  const args = getArgumentsInSignature(line);
  const argumentCount = args.length;
  if (argumentCount > 0) {
    for (let i = 0; i < args.length; i++) {
      if (args[i].name === symbol) {
        argumentIndex = i;
        break;
      }
    }
    if (argumentIndex === undefined) {
      return undefined;
    }
  } else {
    return undefined;
  }
  return {
    index: argumentIndex,
    totalCount: argumentCount,
    isMethod: line.includes("defmethod"), // if it's a method, make the first arg be `obj`
  };
}

// Determines the name of the current function/method that we are in
export function determineCurrentFunctionName(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | undefined {
  for (let i = position.line; i > 0; i--) {
    const currLine = document.lineAt(i).text;
    const matches = [
      ...currLine.matchAll(/(?:defun(?:-debug)?|defmethod)\s+([^\s]*)/g),
    ];
    if (matches.length == 1) {
      // Functions are easy
      if (currLine.includes("defun")) {
        return matches[0][1].toString();
      } else {
        // methods are more difficult, for now we walk back until we run out
        // of lines or hit an empty line
        //
        // hopefully we find a comment giving us the information we require
        // before then
        let prevLineIdx = i - 1;
        while (
          prevLineIdx > 0 &&
          document.lineAt(prevLineIdx).text.trim() !== ""
        ) {
          if (
            document
              .lineAt(prevLineIdx)
              .text.toLowerCase()
              .includes(";; definition for method")
          ) {
            const methodMatches = [
              ...document
                .lineAt(prevLineIdx)
                .text.matchAll(/;; definition for method (\d+) of type (.*)/g),
            ];
            if (methodMatches.length == 1) {
              return `(method ${methodMatches[0][1]} ${methodMatches[0][2]})`;
            } else {
              return undefined;
            }
          }
          prevLineIdx--;
        }
      }
    }
  }
  return undefined;
}
