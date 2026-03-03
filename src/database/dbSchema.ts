import * as fs from "fs";
import type { DbColumn, DbSchema } from "../contracts/databaseTypes";

export type { DbColumn, DbSchema } from "../contracts/databaseTypes";

// ── Internal helpers (exported for dbViews / dbCommands) ───────────

export const SCHEMA_FENCE_START = /^```lotion-db\s*$/;
export const SCHEMA_FENCE_END = /^```\s*$/;

/** Extract lines inside a fenced code block matching the given start pattern. */
export function extractFencedLines(text: string, startPattern: RegExp): string[] {
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  const result: string[] = [];

  for (const line of lines) {
    if (!inBlock && startPattern.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (SCHEMA_FENCE_END.test(line)) {
        break;
      }
      result.push(line);
    }
  }

  return result;
}

// ── Schema parsing ─────────────────────────────────────────────────

/**
 * Parse the `lotion-db` schema block from a database index.md file.
 * Returns the schema and the line range of the code block.
 */
export function parseSchemaFromFile(filePath: string): DbSchema | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return parseSchemaFromText(content);
}

export function parseSchemaFromText(text: string): DbSchema | undefined {
  const yamlLines = extractFencedLines(text, SCHEMA_FENCE_START);
  if (yamlLines.length === 0) {
    return undefined;
  }
  return parseSimpleYaml(yamlLines);
}

/**
 * Minimal parser for our schema YAML subset:
 *
 * columns:
 *   - name: Status
 *     type: select
 *     options: [Not Started, In Progress, Done]
 *   - name: Due Date
 *     type: date
 */
function parseSimpleYaml(lines: string[]): DbSchema | undefined {
  const columns: DbColumn[] = [];
  let current: Partial<DbColumn> | null = null;
  let titleField: string | undefined;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.match(/^columns:\s*$/)) {
      continue;
    }

    const titleFieldMatch = line.match(/^titleField:\s*(.+)$/);
    if (titleFieldMatch) {
      titleField = titleFieldMatch[1].trim();
      continue;
    }

    const dashName = line.match(/^\s+-\s+name:\s*(.+)$/);
    if (dashName) {
      if (current && current.name && current.type) {
        columns.push(current as DbColumn);
      }
      current = { name: dashName[1].trim() };
      continue;
    }

    const typeLine = line.match(/^\s+type:\s*(.+)$/);
    if (typeLine && current) {
      current.type = typeLine[1].trim() as DbColumn["type"];
      continue;
    }

    const optionsLine = line.match(/^\s+options:\s*\[(.+)\]$/);
    if (optionsLine && current) {
      current.options = optionsLine[1].split(",").map((s) => s.trim());
      continue;
    }

    const maxWidthLine = line.match(/^\s+maxWidth:\s*(\d+)$/);
    if (maxWidthLine && current) {
      current.maxWidth = parseInt(maxWidthLine[1], 10);
      continue;
    }

    const maxHeightLine = line.match(/^\s+maxHeight:\s*(\d+)$/);
    if (maxHeightLine && current) {
      current.maxHeight = parseInt(maxHeightLine[1], 10);
      continue;
    }
  }

  // Push last column
  if (current && current.name && current.type) {
    columns.push(current as DbColumn);
  }

  if (columns.length === 0) {
    return undefined;
  }
  return { columns, titleField };
}

// ── Schema serialization ───────────────────────────────────────────

export function serializeSchema(schema: DbSchema): string {
  const lines: string[] = [];
  if (schema.titleField) {
    lines.push(`titleField: ${schema.titleField}`);
  }
  lines.push("columns:");
  for (const col of schema.columns) {
    lines.push(`  - name: ${col.name}`);
    lines.push(`    type: ${col.type}`);
    if (col.options && col.options.length > 0) {
      lines.push(`    options: [${col.options.join(", ")}]`);
    }
    if (col.maxWidth !== undefined) {
      lines.push(`    maxWidth: ${col.maxWidth}`);
    }
    if (col.maxHeight !== undefined) {
      lines.push(`    maxHeight: ${col.maxHeight}`);
    }
  }
  return lines.join("\n");
}
