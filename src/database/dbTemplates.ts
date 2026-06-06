import * as fs from "fs";
import * as path from "path";
import { Regex } from "../core/regex";
import { parsePropertyTable } from "./dbFrontmatter";

// ── Per-database entry templates ───────────────────────────────────
//
// Templates live in `.templates/<name>.md` under the DB folder. Each
// template file uses the same shape as an entry — an optional property
// table that supplies default property values, plus a free-form body
// that becomes the new entry's body content.
//
// The folder is hidden (`.`-prefixed) so it's already excluded by the
// DB-entry walker (`readDbEntries` filters dot-folders), meaning
// templates don't accidentally appear as entries.

const TEMPLATES_DIRNAME = ".templates";

export interface TemplateFile {
  name: string;
  path: string;
}

/** List all template files in the DB folder. Empty array when none. */
export function listTemplates(dbDir: string): TemplateFile[] {
  const dir = path.join(dbDir, TEMPLATES_DIRNAME);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return [];
  }

  const out: TemplateFile[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const fullPath = path.join(dir, file);
    // A `.templates/foo.md/` *directory* (or a dangling symlink) would
    // otherwise sneak through and trigger EISDIR / ENOENT inside
    // readFileSync at picker time. Skip anything that isn't a regular
    // file (or follows to one).
    try {
      if (!fs.statSync(fullPath).isFile()) continue;
    } catch {
      continue;
    }
    out.push({
      name: file.replace(/\.md$/, ""),
      path: fullPath,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export interface ParsedTemplate {
  /** Default property values pulled from the template's property table. */
  defaults: Record<string, string>;
  /** Body content after the property table — becomes the new entry's body. */
  body: string;
}

/**
 * Split a template file's contents into property-table defaults and body.
 * A template without a property table is body-only (no defaults).
 */
export function parseTemplate(content: string): ParsedTemplate {
  const defaults = parsePropertyTable(content) ?? {};
  return { defaults, body: extractBodyAfterPropertyTable(content) };
}

/** Read + parse a template file from disk. Returns undefined on any I/O failure. */
export function readTemplate(filePath: string): ParsedTemplate | undefined {
  try {
    return parseTemplate(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * Strip the property table (header + separator + all data rows) from
 * `content` and return whatever follows.
 *
 * Two intentional shortcuts:
 *  - When a property table is present, **anything above it is dropped**
 *    (template H1, intro prose, etc.). The new entry's heading is built
 *    by `dbEntryCreate` from the user-typed title; template prose that
 *    needs to survive should sit below the property table.
 *  - When no property table is present, a leading H1 is stripped (same
 *    reason) and everything else passes through.
 */
function extractBodyAfterPropertyTable(content: string): string {
  const lines = content.split(Regex.lineBreakSplit);

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (Regex.propertyTableHeader.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }

  let bodyStart = 0;
  if (headerIdx !== -1 && headerIdx + 1 < lines.length && Regex.propertyTableSeparator.test(lines[headerIdx + 1])) {
    let endIdx = headerIdx + 1;
    for (let i = headerIdx + 2; i < lines.length; i++) {
      if (!lines[i].startsWith("|")) break;
      endIdx = i;
    }
    bodyStart = endIdx + 1;
  } else {
    // No property table — skip a leading H1 if present (the entry creator
    // builds its own heading from the title).
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;
      if (Regex.headingH1Multiline.test(lines[i])) {
        bodyStart = i + 1;
      }
      break;
    }
  }

  return lines.slice(bodyStart).join("\n").replace(/^\n+/, "");
}
