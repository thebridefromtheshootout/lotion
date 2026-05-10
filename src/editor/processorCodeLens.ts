import { CodeLens, Disposable } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Cmd } from "../core/commands";
import { createCodeLensProvider, codeLens } from "../core/codeLens";
import { PROC_START_RE } from "./processorBlock";

// ── CodeLens provider ──────────────────────────────────────────────

export function generateProcessorLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const m = document.lineAt(i).text.match(PROC_START_RE);
    if (!m) {
      continue;
    }

    const lineLen = document.lineAt(i).text.length;
    lenses.push(
      codeLens(i, "▶ Run processor", Cmd.refreshProcessors, [document.uri.toString(), i, 0], {
        endChar: lineLen,
      }),
      codeLens(i, "✏️ Edit command", Cmd.updateProcessor, [document.uri.toString(), i, 0], {
        endChar: lineLen,
      }),
    );
  }

  return lenses;
}

export function createProcessorCodeLensProvider(): Disposable {
  return createCodeLensProvider(generateProcessorLenses);
}
