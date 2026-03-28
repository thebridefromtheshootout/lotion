import * as fs from "fs";
import { extractFencedLines, SCHEMA_FENCE_START, SCHEMA_FENCE_END } from "./dbSchema";
import type { DbFilterOperator, DbViewFilter, DbFilterClause, DbView, LayoutKind } from "../contracts/databaseTypes";
import { Regex } from "../core/regex";

export type { DbFilterOperator, DbViewFilter, DbFilterClause, DbView, LayoutKind } from "../contracts/databaseTypes";

// ── View parsing ───────────────────────────────────────────────────

const VIEWS_FENCE_START = Regex.dbViewsFenceStart;

export function parseViewsFromFile(filePath: string): DbView[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return parseViewsFromText(content);
}

export function parseViewsFromText(text: string): DbView[] {
  const yamlLines = extractFencedLines(text, VIEWS_FENCE_START);
  if (yamlLines.length === 0) {
    return [];
  }
  return parseViewsYaml(yamlLines);
}

function parseViewsYaml(lines: string[]): DbView[] {
  const views: DbView[] = [];
  let current: Partial<DbView> | null = null;
  let inFilters = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.match(Regex.dbViewsLine)) {
      continue;
    }

    const dashName = line.match(Regex.dbDashNameLine);
    if (dashName) {
      appendCurrentView(views, current);
      current = { name: dashName[1].trim(), filters: [] };
      inFilters = false;
      continue;
    }

    if (!current) {
      continue;
    }

    const defaultLine = line.match(Regex.dbDefaultLine);
    if (defaultLine) {
      current.default = defaultLine[1] === "true";
      continue;
    }

    const sortColLine = line.match(Regex.dbSortColLine);
    if (sortColLine) {
      const val = sortColLine[1].trim();
      current.sortCol = val === "null" ? null : val;
      continue;
    }

    const sortDirLine = line.match(Regex.dbSortDirLine);
    if (sortDirLine) {
      current.sortDir = sortDirLine[1] as "asc" | "desc";
      continue;
    }

    const layoutLine = line.match(Regex.dbLayoutLine);
    if (layoutLine) {
      current.layout = layoutLine[1] as LayoutKind;
      continue;
    }

    const kanbanGroupLine = line.match(Regex.dbKanbanGroupLine);
    if (kanbanGroupLine) {
      current.kanbanGroupCol = kanbanGroupLine[1].trim();
      continue;
    }

    const calDateLine = line.match(Regex.dbCalendarDateLine);
    if (calDateLine) {
      current.calendarDateCol = calDateLine[1].trim();
      continue;
    }

    const calEndDateLine = line.match(Regex.dbCalendarEndDateLine);
    if (calEndDateLine) {
      current.calendarEndDateCol = calEndDateLine[1].trim();
      continue;
    }

    if (line.match(Regex.dbFiltersLine)) {
      inFilters = true;
      continue;
    }

    if (inFilters) {
      const filterCol = line.match(Regex.dbFilterColLine);
      if (filterCol) {
        current.filters!.push({ col: filterCol[1].trim(), op: "contains", value: "" });
        continue;
      }
      const filterOp = line.match(Regex.dbFilterOpLine);
      if (filterOp && current.filters!.length > 0) {
        current.filters![current.filters!.length - 1].op = filterOp[1].trim() as DbFilterOperator;
        continue;
      }
      const filterVal = line.match(Regex.dbFilterValueLine);
      if (filterVal && current.filters!.length > 0) {
        current.filters![current.filters!.length - 1].value = filterVal[1].trim();
        continue;
      }
    }
  }

  appendCurrentView(views, current);

  return views;
}

function appendCurrentView(views: DbView[], current: Partial<DbView> | null): void {
  if (!current?.name) {
    return;
  }
  views.push({
    ...current,
    filters: current.filters ?? [],
  } as DbView);
}

// ── View serialization ─────────────────────────────────────────────

export function serializeViews(views: DbView[]): string {
  const lines: string[] = ["views:"];
  for (const v of views) {
    lines.push(`  - name: ${v.name}`);
    if (v.default) {
      lines.push(`    default: true`);
    }
    if (v.sortCol !== undefined && v.sortCol !== null) {
      lines.push(`    sortCol: ${v.sortCol}`);
      lines.push(`    sortDir: ${v.sortDir ?? "asc"}`);
    }
    if (v.layout && v.layout !== "table") {
      lines.push(`    layout: ${v.layout}`);
    }
    if (v.kanbanGroupCol) {
      lines.push(`    kanbanGroupCol: ${v.kanbanGroupCol}`);
    }
    if (v.calendarDateCol) {
      lines.push(`    calendarDateCol: ${v.calendarDateCol}`);
    }
    if (v.calendarEndDateCol) {
      lines.push(`    calendarEndDateCol: ${v.calendarEndDateCol}`);
    }
    if (v.filters.length > 0) {
      lines.push(`    filters:`);
      for (const f of v.filters) {
        lines.push(`      - col: ${f.col}`);
        lines.push(`        op: ${f.op || "contains"}`);
        lines.push(`        value: ${f.value}`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Write views into the lotion-db-views code block in index.md.
 * Creates the block if it doesn't exist, replaces it if it does.
 */
export function saveViewsToFile(filePath: string, views: DbView[]): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(Regex.lineBreakSplit);
  const newBlock = "```lotion-db-views\n" + serializeViews(views) + "\n```";

  // Find existing views block
  let blockStart = -1;
  let blockEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (VIEWS_FENCE_START.test(lines[i])) {
      blockStart = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (SCHEMA_FENCE_END.test(lines[j])) {
          blockEnd = j;
          break;
        }
      }
      break;
    }
  }

  let newContent: string;
  if (blockStart !== -1 && blockEnd !== -1) {
    // Replace existing block
    const before = lines.slice(0, blockStart);
    const after = lines.slice(blockEnd + 1);
    newContent = [...before, newBlock, ...after].join("\n");
  } else {
    // Insert after the schema block (after its closing ```)
    let schemaEnd = -1;
    let inSchema = false;
    for (let i = 0; i < lines.length; i++) {
      if (SCHEMA_FENCE_START.test(lines[i])) {
        inSchema = true;
        continue;
      }
      if (inSchema && SCHEMA_FENCE_END.test(lines[i])) {
        schemaEnd = i;
        break;
      }
    }
    if (schemaEnd !== -1) {
      const before = lines.slice(0, schemaEnd + 1);
      const after = lines.slice(schemaEnd + 1);
      newContent = [...before, "", newBlock, ...after].join("\n");
    } else {
      // Fallback: append
      newContent = content + "\n\n" + newBlock + "\n";
    }
  }

  fs.writeFileSync(filePath, newContent, "utf-8");
}
