import * as path from "path";
import * as fs from "fs";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Position } from "../hostEditor/EditorTypes";
import { parsePropertyTable } from "./dbFrontmatter";
import type { DbEntry } from "../contracts/databaseTypes";
import { Regex } from "../core/regex";

export type { DbEntry } from "../contracts/databaseTypes";

// ── Read all entries in a database ─────────────────────────────────

/**
 * Read all child entries of a database directory.
 * Each entry is a <slug>/index.md with frontmatter.
 */
export function readDbEntries(dbDir: string): DbEntry[] {
  if (!fs.existsSync(dbDir)) {
    return [];
  }

  const entries: DbEntry[] = [];
  for (const dir of fs.readdirSync(dbDir)) {
    const dirPath = path.join(dbDir, dir);
    // Skip non-directories and hidden folders
    if (!fs.statSync(dirPath).isDirectory() || dir.startsWith(".")) {
      continue;
    }
    const entryPath = path.join(dirPath, "index.md");
    if (!fs.existsSync(entryPath)) {
      continue;
    }

    const content = fs.readFileSync(entryPath, "utf-8");
    // Skip database files (they have a lotion-db block)
    if (Regex.dbSchemaFenceStartMultiline.test(content)) {
      continue;
    }
    const props = parsePropertyTable(content) ?? {};

    // Extract title from first heading
    const headingMatch = content.match(Regex.headingH1Multiline);
    const title = headingMatch ? headingMatch[1] : dir;

    entries.push({
      title,
      relativePath: `${dir}/index.md`,
      properties: props,
    });
  }

  return entries;
}

// ── isDbFile result cache ──────────────────────────────────────────
//
// `isDbFile` is on the cursor-context hot path (every cursor move fans
// out to cursorInDbEntry → findParentDbIndex → isDbFile). It used to
// fs.readFileSync the candidate index.md on every keystroke; here we
// stat() instead and only re-read the file when mtime changes.
//
// Cache is also evicted explicitly on save (see invalidateDbFileCache),
// covering the case where the user adds/removes a `lotion-db` fence.

interface DbFileCacheEntry {
  mtimeMs: number;
  size: number;
  isDb: boolean;
}
const dbFileCache = new Map<string, DbFileCacheEntry>();

/** Drop the cached classification for `filePath` (call after a save). */
export function invalidateDbFileCache(filePath: string): void {
  dbFileCache.delete(filePath);
}

/**
 * Check if a file is a database index.md (contains a lotion-db code block).
 * Cached by (path, mtime, size); explicit invalidation via invalidateDbFileCache.
 */
export function isDbFile(filePath: string): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const cached = dbFileCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.isDb;
  }
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return false;
  }
  const isDb = Regex.dbSchemaFenceStartMultiline.test(content);
  dbFileCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, isDb });
  return isDb;
}

// Per-document memo for cursorInDb: regex-test the doc text once per
// version, reuse on later cursor moves until the text changes.
const cursorInDbCache = new WeakMap<TextDocument, { version: number; result: boolean }>();

/**
 * Predicate for slash commands — true when the current file is a DB index.
 * Matches the (document, position) => boolean signature used by SlashCommand.when.
 */
export function cursorInDb(document: TextDocument, _position: Position): boolean {
  const cached = cursorInDbCache.get(document);
  if (cached && cached.version === document.version) return cached.result;
  const result = Regex.dbSchemaFenceStartMultiline.test(document.getText());
  cursorInDbCache.set(document, { version: document.version, result });
  return result;
}

/**
 * True when the current file is a child entry of a database.
 * Structure: dbDir/index.md (DB index) and dbDir/<slug>/index.md (child entry).
 * So from a child, the DB index is at ../../index.md relative to the child file.
 */
export function cursorInDbEntry(document: TextDocument, _position: Position): boolean {
  const filePath = document.uri.fsPath;
  const dbIndexPath = findParentDbIndex(filePath);
  return dbIndexPath !== undefined;
}

/**
 * Given a file path, find the parent DB index.md if this file is a DB child entry.
 * Returns the DB index path, or undefined if not a child entry.
 */
export function findParentDbIndex(filePath: string): string | undefined {
  // Child entry structure: dbDir/<slug>/index.md
  // DB index:              dbDir/index.md
  const parentDir = path.dirname(filePath);           // dbDir/<slug>
  const dbDir = path.dirname(parentDir);              // dbDir
  const candidateIndex = path.join(dbDir, "index.md");
  if (candidateIndex === filePath) return undefined;   // this IS the index
  // isDbFile handles the existsSync (it returns false on stat failure)
  return isDbFile(candidateIndex) ? candidateIndex : undefined;
}
