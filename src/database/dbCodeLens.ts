
import { CodeLens, Disposable } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import * as path from "path";
import * as fs from "fs";
import { isDbFile } from "./database";
import { Cmd } from "../core/commands";
import { createCodeLensProvider, codeLens } from "../core/codeLens";
import { Regex } from "../core/regex";

// ── CodeLens provider for database links ───────────────────────────

const PAGE_LINK_RE = Regex.markdownPageLinkLine;

/**
 * If `filePath` is an entry inside a database folder, return the
 * absolute path to the database's index.md. Otherwise return undefined.
 *
 * Database layout:
 *   dbFolder/index.md          ← the DB file (has ```lotion-db block)
 *   dbFolder/entry-slug/index.md  ← entry file
 */
function getParentDbIndex(filePath: string): string | undefined {
  // entry is at  dbFolder/slug/index.md  → parent dir is slug, grandparent is dbFolder
  const entryDir = path.dirname(filePath);          // dbFolder/slug
  const dbDir = path.dirname(entryDir);             // dbFolder
  const candidate = path.join(dbDir, "index.md");
  if (candidate === filePath) {
    return undefined; // this IS the index.md, not an entry
  }
  if (fs.existsSync(candidate) && isDbFile(candidate)) {
    return candidate;
  }
  return undefined;
}

export function generateDbLenses(document: TextDocument): CodeLens[] {
  const filePath = document.uri.fsPath;
  const cwd = path.dirname(filePath);
  const lenses: CodeLens[] = [];

  // If this file itself is a database, show a "View database" lens at the top
  if (isDbFile(filePath)) {
    lenses.push(
      codeLens(0, "📊 View database", Cmd.openDbWebview, [filePath], {
        endChar: document.lineAt(0).text.length,
      }),
    );
  }

  // If this file is a database entry, show a "View database" lens at the top
  const parentDb = getParentDbIndex(filePath);
  if (parentDb) {
    lenses.push(
      codeLens(0, "📊 View database", Cmd.openDbWebview, [parentDb], {
        endChar: document.lineAt(0).text.length,
      }),
    );
  }

  // Scan for links pointing to database index files
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const match = line.text.match(PAGE_LINK_RE);
    if (!match) {
      continue;
    }

    const linkPath = match[2];
    const absPath = path.resolve(cwd, linkPath);

    if (isDbFile(absPath)) {
      lenses.push(
        codeLens(i, "📊 View database", Cmd.openDbWebview, [absPath], {
          endChar: line.text.length,
        }),
      );
    }
  }

  return lenses;
}

export function createDbCodeLensProvider(): Disposable {
  return createCodeLensProvider(generateDbLenses);
}
