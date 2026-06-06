// ── Shared markdown-table formatter ────────────────────────────────
//
// Pure functions consumed by both the webview (Toolbar "Copy MD"
// button) and the extension host (/regen-from-db command). Keeping
// the formatter here ensures both sides emit byte-identical output —
// /regen-from-db can refresh a table without changing whitespace if
// the underlying data hasn't changed.

/** HTML comment that marks a table as DB-derived. */
export const DB_TABLE_MARKER_PREFIX = "<!-- lotion-db-table source=";

/** Regex matching the marker line; capture group is the source path. */
export const DB_TABLE_MARKER_REGEX = /<!--\s*lotion-db-table\s+source="([^"]+)"\s*-->/;

function escapeMdCell(raw: string): string {
  // GFM: a pipe inside a cell must be backslash-escaped; collapse
  // newlines to spaces so multi-line cell values don't break the table.
  return raw.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function pad(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - s.length));
}

/**
 * Format a marker-prefixed GFM table.
 *
 * @param headers Column header labels.
 * @param rows Per-row cell values, in header order.
 * @param dbWorkspacePath Workspace-relative path to the source DB index.md,
 *   embedded in the marker so /regen-from-db can resolve it.
 */
export function formatMarkdownTable(headers: string[], rows: string[][], dbWorkspacePath: string): string {
  const widths = headers.map((h, i) =>
    Math.max(
      escapeMdCell(h).length,
      ...rows.map((r) => escapeMdCell(r[i] ?? "").length),
      3, // minimum so the separator row is at least `---`
    ),
  );

  const fmtRow = (cells: string[]) => `| ${cells.map((c, i) => pad(escapeMdCell(c), widths[i])).join(" | ")} |`;
  const separator = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
  const marker = `${DB_TABLE_MARKER_PREFIX}"${dbWorkspacePath}" -->`;

  return [marker, fmtRow(headers), separator, ...rows.map(fmtRow)].join("\n");
}
