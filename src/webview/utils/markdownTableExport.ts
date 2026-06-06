import type { DbColumn, DbEntryData } from "../types";
import { DB_TABLE_MARKER_PREFIX, formatMarkdownTable } from "../../contracts/dbMarkdownTable";

// Re-export so existing imports (including the unit test) keep working.
export { DB_TABLE_MARKER_PREFIX };

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
  const rows = entries.map((e) => [e.title ?? "", ...schema.map((c) => e.properties[c.name] ?? "")]);
  return formatMarkdownTable(headers, rows, dbWorkspacePath);
}
