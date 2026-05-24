import type { DbColumn, DbEntryData } from "../types";

// ── Markdown table export ──────────────────────────────────────────
//
// Output a GFM-flavoured table prefixed with a single-line origin
// marker that `/regen-from-db` can locate:
//
//   <!-- lotion-db-table source="projects/index.md" -->
//   | Title | Status |
//   | ----- | ------ |
//   | …     | …      |
//
// The marker is the authority on which DB the table came from — the
// table itself is purely display state. Dataflow is intentionally
// one-way (DB → table), so editing cells in the table never writes
// back to the DB.

/** HTML comment that marks the table as DB-derived. */
export const DB_TABLE_MARKER_PREFIX = "<!-- lotion-db-table source=";

function escapeMdCell(raw: string): string {
  // GFM: a pipe inside a cell must be backslash-escaped; collapse newlines
  // to spaces so multi-line cell values don't break the table.
  return raw.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function pad(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - s.length));
}

/**
 * Render a DB view as a marker-prefixed GFM table.
 *
 * @param dbWorkspacePath Workspace-relative path to the source DB index.md
 *   (e.g. "projects/index.md"). Embedded in the marker so /regen-from-db
 *   knows which DB to re-read.
 */
export function entriesToMarkdownTable(
  entries: DbEntryData[],
  schema: DbColumn[],
  titleFieldLabel: string,
  dbWorkspacePath: string,
): string {
  const headers = [titleFieldLabel, ...schema.map((c) => c.name)];
  const rawRows = entries.map((e) => [e.title ?? "", ...schema.map((c) => e.properties[c.name] ?? "")]);

  const widths = headers.map((h, i) =>
    Math.max(
      escapeMdCell(h).length,
      ...rawRows.map((r) => escapeMdCell(r[i] ?? "").length),
      3, // minimum column width so the separator row is at least `---`
    ),
  );

  const fmtRow = (cells: string[]) => `| ${cells.map((c, i) => pad(escapeMdCell(c), widths[i])).join(" | ")} |`;
  const separator = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;

  const marker = `${DB_TABLE_MARKER_PREFIX}"${dbWorkspacePath}" -->`;
  return [marker, fmtRow(headers), separator, ...rawRows.map(fmtRow)].join("\n");
}
