import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { getBlockIndex } from "../core/blockIndex";

// ── Table detection ────────────────────────────────────────────────

const TABLE_ROW_RE = Regex.markdownTableRow;

/** Check if a line looks like a table row (starts and ends with |). */
function isTableRow(line: string): boolean {
  return TABLE_ROW_RE.test(line);
}

/**
 * Find the full range of the table surrounding the given line.
 * Returns undefined if the line is not inside a table.
 */
export function getTableRange(document: TextDocument, line: number): { start: number; end: number } | undefined {
  if (!isTableRow(document.lineAt(line).text)) {
    return undefined;
  }

  let start = line;
  while (start > 0 && isTableRow(document.lineAt(start - 1).text)) {
    start--;
  }

  let end = line;
  const lastLine = document.lineCount - 1;
  while (end < lastLine && isTableRow(document.lineAt(end + 1).text)) {
    end++;
  }

  return { start, end };
}

/** Returns true if the cursor is currently inside a markdown table. */
export function cursorInTable(document: TextDocument, position: Position): boolean {
  return getBlockIndex(document).tableAt(position.line) !== undefined;
}

// ── Parsing & serialization ────────────────────────────────────────

/** Exported for cross-feature reuse (e.g. database/dbTabularImport.ts table-to-db). */
export function parseRow(line: string): string[] {
  // Split by |, drop first and last empty segments
  const parts = line.split("|");
  return parts.slice(1, -1).map((c) => c.trim());
}

/** Exported for cross-feature reuse (e.g. database/dbTabularImport.ts table-to-db). */
export function parseTable(
  document: TextDocument,
  range: { start: number; end: number },
): { headers: string[]; rows: string[][] } | undefined {
  if (range.end - range.start < 2) {
    return undefined; // need at least header + separator + 0 data rows
  }

  const headers = parseRow(document.lineAt(range.start).text);
  // Skip separator line (range.start + 1)
  const rows: string[][] = [];
  for (let i = range.start + 2; i <= range.end; i++) {
    rows.push(parseRow(document.lineAt(i).text));
  }

  return { headers, rows };
}

export function computeColWidths(headers: string[], rows: string[][]): number[] {
  return headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => Math.max(max, (row[i] || "").length), 0);
    return Math.max(h.length, maxData, 3); // minimum 3 for separator ---
  });
}

export function serializeTable(headers: string[], rows: string[][], colWidths: number[]): string {
  const pad = (text: string, width: number) => text.padEnd(width);

  const headerLine = "| " + headers.map((h, i) => pad(h, colWidths[i])).join(" | ") + " |";
  const separatorLine = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const dataLines = rows.map((row) => "| " + row.map((cell, i) => pad(cell, colWidths[i])).join(" | ") + " |");

  return [headerLine, separatorLine, ...dataLines].join("\n");
}

// ── Cell-position helpers ──────────────────────────────────────────

/** Which column the cursor is in within a table row line. */
export function getColumnAtCursor(lineText: string, charPos: number): number {
  let col = -1; // before first |
  for (let i = 0; i < charPos && i < lineText.length; i++) {
    if (lineText[i] === "|") {
      col++;
    }
  }
  return Math.max(0, col);
}

/**
 * Return the character range (start, end) of the content of column `col`
 * within a table row string. Columns are 0-indexed.
 */
export function getCellRange(lineText: string, col: number): { start: number; end: number } | undefined {
  let pipeCount = -1;
  let cellStart = -1;

  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === "|") {
      pipeCount++;
      if (pipeCount === col) {
        cellStart = i + 1;
      } else if (pipeCount === col + 1) {
        // Trim leading/trailing spaces within the cell for selection
        let s = cellStart;
        let e = i;
        while (s < e && lineText[s] === " ") {
          s++;
        }
        while (e > s && lineText[e - 1] === " ") {
          e--;
        }
        return { start: s, end: e };
      }
    }
  }
  return undefined;
}

// ── Write primitive ────────────────────────────────────────────────

/** Replace the entire table at `range` with re-aligned text built from `headers` and `rows`. */
export function replaceTable(
  document: TextDocument,
  range: { start: number; end: number },
  headers: string[],
  rows: string[][],
): Promise<void> {
  const colWidths = computeColWidths(headers, rows);
  const tableText = serializeTable(headers, rows, colWidths);

  const fullRange = new Range(
    new Position(range.start, 0),
    new Position(range.end, document.lineAt(range.end).text.length),
  );

  return hostEditor.replaceRange(fullRange, tableText);
}
