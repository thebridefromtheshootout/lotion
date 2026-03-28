// -- database.ts -- barrel re-exports ----------------------------------------
// This file used to contain all database logic in a single monolith.
// It has been split into focused modules; this barrel preserves the
// existing public API so that other files can still import from
// "./database" without changes.

export { DbColumn, DbSchema, parseSchemaFromFile, parseSchemaFromText, serializeSchema } from "./dbSchema";
export { SCHEMA_FENCE_START, SCHEMA_FENCE_END, extractFencedLines } from "./dbSchema";

export {
  DbFilterOperator,
  DbViewFilter,
  DbFilterClause,
  DbView,
  parseViewsFromFile,
  parseViewsFromText,
  serializeViews,
  saveViewsToFile,
} from "./dbViews";

export { parsePropertyTable, updateEntryProperty, buildPropertyTable, appendToLogTable, clearPropertyFields, removePropertyFields } from "./dbFrontmatter";

export { DbEntry, readDbEntries, isDbFile, cursorInDb } from "./dbEntries";

export {
  handleDatabaseCommand,
  handleDbEntryCommand,
  promptForColumnValue,
  handleNewFieldCommand,
  handleDeleteFieldCommand,
  handleTableToDbCommand,
  handleCsvToDbCommand,
  handleNewViewCommand,
  logEntryAndPromptNew,
} from "./dbCommands";

// Re-export contract types that used to live here
export { LayoutKind, DbEntryLink, isFilterLeaf } from "../contracts/databaseTypes";
