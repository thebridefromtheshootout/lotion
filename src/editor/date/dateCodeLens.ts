import { CodeLens, Disposable, Range } from "../../hostEditor/EditorTypes";
import type { TextDocument } from "../../hostEditor/EditorTypes";
import { Cmd } from "../../core/commands";
import { createCodeLensProvider } from "../../core/codeLens";
import { Regex } from "../../core/regex";

// ── Date CodeLens provider ─────────────────────────────────────────

/**
 * Regex matching common date patterns inline:
 * - YYYY-MM-DD (ISO)
 * - MM/DD/YYYY or DD/MM/YYYY (ambiguous; both matched)
 * - Month D, YYYY (January 5, 2024)
 * - D Month YYYY (5 January 2024)
 * - ddd, Month D, YYYY (Mon, January 5, 2024)
 */
const DATE_PATTERNS = Regex.datePatterns;

export function createDateCodeLensProvider(): Disposable {
  return createCodeLensProvider(generateDateLenses);
}

export function generateDateLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const lineText = document.lineAt(i).text;

    for (const pat of DATE_PATTERNS) {
      pat.lastIndex = 0; // reset global regex
      let m: RegExpExecArray | null;
      while ((m = pat.exec(lineText)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        const before = start > 0 ? lineText[start - 1] : " ";
        const after = end < lineText.length ? lineText[end] : " ";

        // Only show date lenses when dates are whitespace-delimited.
        if (!/\s/.test(before) || !/\s/.test(after)) {
          continue;
        }

        // Avoid duplicate / overlapping lenses on the same line.
        const overlapIdx = lenses.findIndex(
          (l) => l.range.start.line === i && l.range.start.character < end && l.range.end.character > start,
        );
        const range = new Range(i, start, i, end);

        if (overlapIdx !== -1) {
          const existing = lenses[overlapIdx];
          const existingLen = existing.range.end.character - existing.range.start.character;
          if (end - start > existingLen) {
            // New match is longer — replace the existing one
            lenses[overlapIdx] = new CodeLens(range, {
              title: "📅 Update date",
              command: Cmd.updateDate,
              arguments: [document.uri.toString(), i, start, end],
            });
          }
          continue;
        }
        lenses.push(
          new CodeLens(range, {
            title: "📅 Update date",
            command: Cmd.updateDate,
            arguments: [document.uri.toString(), i, start, end],
          }),
        );
      }
    }
  }

  return lenses;
}
