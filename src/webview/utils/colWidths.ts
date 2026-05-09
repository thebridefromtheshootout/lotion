// Per-database persistence for table-view column widths.
// Keyed by dbName so two open dbviews don't clobber each other in the same
// vscode session.

const STORAGE_KEY_PREFIX = "lotion.dbview.colWidths.";
const MIN_WIDTH = 60;
const MAX_WIDTH = 1200;

export type ColumnWidths = Record<string, number>;

function key(dbName: string): string {
  return STORAGE_KEY_PREFIX + dbName;
}

export function loadColumnWidths(dbName: string): ColumnWidths {
  if (!dbName) return {};
  try {
    const raw = window.localStorage.getItem(key(dbName));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: ColumnWidths = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k] = clampWidth(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveColumnWidths(dbName: string, widths: ColumnWidths): void {
  if (!dbName) return;
  try {
    window.localStorage.setItem(key(dbName), JSON.stringify(widths));
  } catch {
    // localStorage unavailable / quota exceeded — fall through silently.
  }
}

export function clampWidth(w: number): number {
  if (!Number.isFinite(w)) return MIN_WIDTH;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));
}
