import * as fs from "fs";
import { Regex } from "../core/regex";

// ── Property-table helpers (internal) ──────────────────────────────

const HEADER_RE = Regex.propertyTableHeader;
const SEPARATOR_RE = Regex.propertyTableSeparator;

interface TableRegion {
  startIdx: number; // header row
  endIdx: number; // last data row (inclusive)
  props: Record<string, string>;
}

function escapePipe(s: string): string {
  return s.replace(Regex.plainPipe, "\\|");
}

/**
 * Locate the `| Property | Value |` table in `lines` and return its region.
 */
function findPropertyTableRegion(lines: string[]): TableRegion | undefined {
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (HEADER_RE.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return undefined;
  }

  // Expect a separator row right after the header
  if (headerIdx + 1 >= lines.length || !SEPARATOR_RE.test(lines[headerIdx + 1])) {
    return undefined;
  }

  const props: Record<string, string> = {};
  let endIdx = headerIdx + 1; // at least the separator

  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!lines[i].startsWith("|")) {
      break;
    }
    // Split on unescaped pipes: replace \| with placeholder, split, restore
    const PH = "\x00";
    const cells = lines[i]
      .replace(Regex.escapedPipe, PH)
      .split("|")
      .slice(1, -1)
      .map((c) => c.replace(new RegExp(PH, "g"), "|").trim());
    if (cells.length >= 2) {
      const key = cells[0];
      const val = cells[1];
      if (key) {
        props[key] = val;
      }
    }
    endIdx = i;
  }

  return { startIdx: headerIdx, endIdx, props };
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Parse the `| Property | Value |` table from entry content.
 * Returns undefined when no property table is found.
 */
export function parsePropertyTable(text: string): Record<string, string> | undefined {
  const region = findPropertyTableRegion(text.split(Regex.lineBreakSplit));
  return region ? region.props : undefined;
}

/**
 * Build an aligned 2-column property table string (including header + separator).
 */
export function buildPropertyTable(props: Record<string, string>): string {
  const entries = Object.entries(props);
  const keyWidth = Math.max("Property".length, ...entries.map(([k]) => escapePipe(k).length));
  const valWidth = Math.max("Value".length, ...entries.map(([, v]) => escapePipe(v).length));

  const pad = (s: string, w: number) => s + " ".repeat(w - s.length);

  const header = `| ${pad("Property", keyWidth)} | ${pad("Value", valWidth)} |`;
  const separator = `| ${"-".repeat(keyWidth)} | ${"-".repeat(valWidth)} |`;
  const rows = entries.map(([k, v]) => `| ${pad(escapePipe(k), keyWidth)} | ${pad(escapePipe(v), valWidth)} |`);

  return [header, separator, ...rows].join("\n");
}

/**
 * Update (or insert) a single property in the entry file's property table.
 * Re-aligns the entire table on every write.
 */
export function updateEntryProperty(filePath: string, key: string, value: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content: string = fs.readFileSync(filePath, "utf-8");
  const lines: string[] = content.split(Regex.lineBreakSplit);
  const region = findPropertyTableRegion(lines);

  if (!region) {
    // No table yet — insert after first heading or at top
    const headingIdx = lines.findIndex((l) => Regex.headingPrefix.test(l));
    const insertIdx = headingIdx !== -1 ? headingIdx + 1 : 0;
    const table = "\n" + buildPropertyTable({ [key]: value }) + "\n";
    lines.splice(insertIdx, 0, table);
    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    return;
  }

  // Update or add the key
  const props = region.props;
  props[key] = value;

  const tableStr = buildPropertyTable(props);
  const before = lines.slice(0, region.startIdx);
  const after = lines.slice(region.endIdx + 1);
  fs.writeFileSync(filePath, [...before, tableStr, ...after].join("\n"), "utf-8");
}

/**
 * Append a row to the log table at the end of the document.
 * Creates the table if it doesn't exist.
 */
export function appendToLogTable(content: string, fieldNames: string[], values: string[]): string {
  const LOG_TABLE_MARKER = "<!-- lotion-log-table -->";
  const lines = content.split(Regex.lineBreakSplit);

  // Look for existing log table
  let tableStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(LOG_TABLE_MARKER)) {
      tableStartIdx = i;
      break;
    }
  }

  // Escape pipe characters in values
  const escapedValues = values.map((v) => v.replace(Regex.plainPipe, "\\|"));
  const newRow = `| ${escapedValues.join(" | ")} |`;

  if (tableStartIdx === -1) {
    // Create new table at end
    const header = `| ${fieldNames.join(" | ")} |`;
    const separator = `| ${fieldNames.map(() => "---").join(" | ")} |`;
    const table = ["", LOG_TABLE_MARKER, "## Log", "", header, separator, newRow].join("\n");
    return content.trimEnd() + "\n" + table + "\n";
  }

  // Find the end of the table (last row starting with |)
  let lastRowIdx = tableStartIdx;
  for (let i = tableStartIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("|")) {
      lastRowIdx = i;
    } else if (lines[i].trim() !== "" && !lines[i].startsWith("#")) {
      break;
    }
  }

  // Insert new row after the last row
  lines.splice(lastRowIdx + 1, 0, newRow);
  return lines.join("\n");
}

/**
 * Clear (set to empty string) the specified property-table fields.
 */
export function clearPropertyFields(content: string, fieldNames: string[]): string {
  const lines = content.split(Regex.lineBreakSplit);
  const region = findPropertyTableRegion(lines);
  if (!region) {
    return content;
  }

  const fieldSet = new Set(fieldNames);
  for (const key of fieldSet) {
    if (key in region.props) {
      region.props[key] = "";
    }
  }

  const tableStr = buildPropertyTable(region.props);
  const before = lines.slice(0, region.startIdx);
  const after = lines.slice(region.endIdx + 1);
  return [...before, tableStr, ...after].join("\n");
}
