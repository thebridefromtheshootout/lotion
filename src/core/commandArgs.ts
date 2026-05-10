// Shared parser for the variadic args VS Code passes to command handlers.
//
// Lotion commands get invoked from three call sites with different shapes:
//
//   1. Slash-command completion       → (docUri: string, line: number, character: number)
//   2. CodeLens / webview message     → (fsPath: string, ...rest: any[])
//   3. Ctrl+Shift+P / keybinding      → no args (falls back to the active editor)
//
// `parseCommandArgs` normalises the runtime shape into a discriminated union
// so each caller can switch on `kind` instead of repeating the same string
// + number + length checks inline.

export type ParsedCommandArgs =
  | { kind: "slash"; docUri: string; line: number; character: number }
  | { kind: "fsPath"; fsPath: string; rest: unknown[] }
  | { kind: "active" };

export function parseCommandArgs(args: unknown[]): ParsedCommandArgs {
  if (
    args.length >= 3 &&
    typeof args[0] === "string" &&
    typeof args[1] === "number" &&
    typeof args[2] === "number"
  ) {
    return {
      kind: "slash",
      docUri: args[0] as string,
      line: args[1] as number,
      character: args[2] as number,
    };
  }
  if (args.length >= 1 && typeof args[0] === "string" && !(args[0] as string).startsWith("file:")) {
    return { kind: "fsPath", fsPath: args[0] as string, rest: args.slice(1) };
  }
  return { kind: "active" };
}
