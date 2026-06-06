// ── Shared markdown-table formatter ────────────────────────────────
//
// Pure functions consumed by both the webview (Toolbar "Copy MD"
// button) and the extension host (/regen-from-db command). Keeping
// the formatter here ensures both sides emit byte-identical output —
// /regen-from-db can refresh a table without changing whitespace if
// the underlying data hasn't changed.

/** HTML comment that marks a table as DB-derived. */
export const DB_TABLE_MARKER_PREFIX = "<!-- lotion-db-table source=";

/** Regex matching the marker line; capture group is the (percent-encoded) source path. */
export const DB_TABLE_MARKER_REGEX = /<!--\s*lotion-db-table\s+source="([^"]+)"\s*-->/;

/**
 * Sanitise a workspace path for embedding inside the marker comment.
 * Two characters would otherwise break the round-trip:
 *
 *   - `"` ends the quoted `source="..."` token early
 *   - `-->` closes the HTML comment prematurely
 *
 * Percent-encoding both (along with `%` itself so the encoding is
 * reversible) keeps the marker parseable while remaining human-readable
 * for any "normal" path. `decodeMarkerSourcePath` reverses the encoding
 * at /regen-from-db time.
 */
export function encodeMarkerSourcePath(path: string): string {
  return path.replace(/[%"]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(/-->/g, "--%3E");
}

export function decodeMarkerSourcePath(encoded: string): string {
  return encoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

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
 *   embedded (after percent-encoding the comment-breaking chars) so
 *   /regen-from-db can resolve it.
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
  const marker = `${DB_TABLE_MARKER_PREFIX}"${encodeMarkerSourcePath(dbWorkspacePath)}" -->`;

  return [marker, fmtRow(headers), separator, ...rows.map(fmtRow)].join("\n");
}
