import * as path from "path";
import * as fs from "fs";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Position } from "../hostEditor/EditorTypes";
import { parsePropertyTable } from "./dbFrontmatter";
import type { DbEntry } from "../contracts/databaseTypes";

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
    if (/^```lotion-db\s*$/m.test(content)) {
      continue;
    }
    const props = parsePropertyTable(content) ?? {};

    // Extract title from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const title = headingMatch ? headingMatch[1] : dir;

    entries.push({
      title,
      relativePath: `${dir}/index.md`,
      properties: props,
    });
  }

  return entries;
}

/**
 * Check if a file is a database index.md (contains a lotion-db code block).
 */
export function isDbFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return /^```lotion-db\s*$/m.test(content);
}

/**
 * Predicate for slash commands — true when the current file is a DB.
 * Matches the (document, position) => boolean signature used by SlashCommand.when.
 */
export function cursorInDb(document: TextDocument, _position: Position): boolean {
  return /^```lotion-db\s*$/m.test(document.getText());
}
