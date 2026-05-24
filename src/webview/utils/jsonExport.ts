import type { DbColumn, DbEntryData } from "../types";

/**
 * Serialize a database view as a JSON array. Each entry becomes an object
 * keyed by the title field plus every schema column in order. The shape
 * mirrors `entriesToCsv` so the CSV and JSON exports stay equivalent.
 */
export function entriesToJson(entries: DbEntryData[], schema: DbColumn[], titleFieldLabel: string): string {
  const rows = entries.map((entry) => {
    const out: Record<string, string> = { [titleFieldLabel]: entry.title ?? "" };
    for (const col of schema) {
      out[col.name] = entry.properties[col.name] ?? "";
    }
    return out;
  });
  return JSON.stringify(rows, null, 2);
}
