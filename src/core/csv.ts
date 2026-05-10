// Shared CSV parsing primitives.
//
// Behaviour notes:
// - Cells are trimmed.
// - Embedded newlines inside quoted cells are preserved.
// - Both \n and \r\n are accepted as row separators.
// - Empty rows (all cells whitespace) are dropped.
// - Doubled quotes inside a quoted cell decode to a single quote.

/**
 * Parse a full CSV document into rows. Each row is a `string[]` of trimmed
 * cells. Empty rows are filtered out.
 */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") {
        i++;
      }
      row.push(cell);
      pushRowIfNonEmpty(rows, row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  pushRowIfNonEmpty(rows, row);
  return rows;
}

/**
 * Convenience wrapper for the case where the caller has already split the
 * text into lines (e.g. clipboard CSV that's known to be one row per line
 * with no embedded newlines).
 */
export function parseCsvLine(line: string): string[] {
  const rows = parseCsvText(line);
  return rows[0] ?? [];
}

function pushRowIfNonEmpty(rows: string[][], row: string[]): void {
  if (row.some((v) => v.trim().length > 0)) {
    rows.push(row.map((v) => v.trim()));
  }
}
