import type { DbColumn, DbEntryData } from "../types";

/**
 * RFC-4180-ish CSV escaper: wraps the value in quotes when it contains
 * a comma, quote, CR, or LF, and doubles internal quotes.
 */
export function escapeCsvCell(raw: string): string {
  if (raw === "") return "";
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Serialize a database view's entries + schema as CSV. The first column is
 * the title field (so links/heading text round-trip), followed by every
 * schema column in order.
 */
export function entriesToCsv(
  entries: DbEntryData[],
  schema: DbColumn[],
  titleFieldLabel: string,
): string {
  const headerCells = [titleFieldLabel, ...schema.map((c) => c.name)].map(escapeCsvCell);
  const lines: string[] = [headerCells.join(",")];

  for (const entry of entries) {
    const row = [entry.title ?? "", ...schema.map((c) => entry.properties[c.name] ?? "")];
    lines.push(row.map(escapeCsvCell).join(","));
  }

  return lines.join("\r\n");
}
