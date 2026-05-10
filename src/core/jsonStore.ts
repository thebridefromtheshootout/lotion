// Shared helpers for typed `.rsrc/<name>.json` load/save pairs.

import * as fs from "fs";
import * as path from "path";

/**
 * Read a JSON store file. If the file is missing, returns `fallback`.
 * If the file is present but unparseable, the broken file is renamed to
 * `<name>.broken-<timestamp>.json` so the next save doesn't silently
 * overwrite the user's data, and `fallback` is returned.
 */
export function loadJsonStore<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    quarantineBrokenFile(filePath);
    return fallback;
  }
}

export function saveJsonStore(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/** Rename a corrupt file out of the way so it isn't overwritten by the next save. */
function quarantineBrokenFile(filePath: string): void {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = path.extname(filePath);
    const base = filePath.slice(0, filePath.length - ext.length);
    fs.renameSync(filePath, `${base}.broken-${stamp}${ext}`);
  } catch {
    // If rename fails (perm error, etc.) we silently fall back to the original
    // behaviour — overwriting on next save. Better than throwing here and
    // breaking the calling slash command.
  }
}
