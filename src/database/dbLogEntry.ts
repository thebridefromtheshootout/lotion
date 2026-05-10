import * as fs from "fs";
import { hostEditor } from "../hostEditor/HostingEditor";
import { DbColumn } from "./dbSchema";
import {
  parsePropertyTable,
  updateEntryProperty,
  appendToLogTable,
  clearPropertyFields,
} from "./dbFrontmatter";
import { promptForColumnValue } from "./dbColumnPrompt";

// ── Log entry flow ─────────────────────────────────────────────────

/**
 * Log entry: move current frontmatter values to a history table in the .md file,
 * clear them, and prompt for new values.
 */
export async function logEntryAndPromptNew(entryFilePath: string, columns: DbColumn[]): Promise<void> {
  if (!fs.existsSync(entryFilePath)) {
    return;
  }

  const originalContent: string = fs.readFileSync(entryFilePath, "utf-8");
  const properties = parsePropertyTable(originalContent);
  if (!properties) {
    hostEditor.showWarning("No property table found in entry.");
    return;
  }

  // Prompt for all new values FIRST.  If the user hits Escape on any
  // prompt, abort the whole flow without touching the file — otherwise
  // we'd leave properties cleared with no replacement values.
  const newValues: Record<string, string> = {};
  for (const col of columns) {
    const val = await promptForColumnValue(col);
    if (val === undefined) {
      return;
    }
    newValues[col.name] = val;
  }

  // Commit: append the prior values to the log table, then clear the
  // property fields, then write the new values.
  const fieldNames = columns.map((c) => c.name);
  const currentValues: string[] = fieldNames.map((name) => properties[name] || "");

  let content = appendToLogTable(originalContent, fieldNames, currentValues);
  content = clearPropertyFields(content, fieldNames);
  fs.writeFileSync(entryFilePath, content, "utf-8");

  for (const col of columns) {
    updateEntryProperty(entryFilePath, col.name, newValues[col.name]);
  }
}
