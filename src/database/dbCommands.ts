// ── Database slash command registry ─────────────────────────────────
// This file used to contain every database command implementation.
// It now wires the SlashCommand metadata to handlers that live in
// focused per-feature modules. Keep imports here pointing at those
// modules so external consumers (extension.ts, database.ts barrel)
// can continue to import handlers via "./dbCommands".

import { Cmd } from "../core/commands";
import { Filter } from "../core/cmdFilter";
import type { SlashCommand } from "../core/slashCommands";

import { handleDatabaseCommand } from "./dbCreate";
import {
  handleNewFieldCommand,
  handleDeleteFieldCommand,
  handleRenameFieldCommand,
  handleSyncFieldOrderCommand,
} from "./dbSchemaEdits";
import { handleNewViewCommand } from "./dbViewCreate";
import { handleTableToDbCommand, handleCsvToDbCommand, handleJsonToDbCommand } from "./dbTabularImport";
import { handleRegenFromDbCommand } from "./dbRegenTable";

// ── Slash command definitions ──────────────────────────────────────

export const DATABASE_SLASH_COMMAND: SlashCommand = {
  label: "/database",
  insertText: "",
  detail: "🗄️ Create a database (typed table)",
  isAction: true,
  commandId: Cmd.createDatabase,
  kind: 21,
  handler: handleDatabaseCommand,
};

export const NEW_ENTRY_SLASH_COMMAND: SlashCommand = {
  label: "/new-entry",
  insertText: "",
  detail: "➕ Add a new database entry",
  isAction: true,
  commandId: Cmd.dbAddEntry,
  cmdFilter: Filter().pageIsDbIndex(),
  kind: 12,
};

export const NEW_VIEW_SLASH_COMMAND: SlashCommand = {
  label: "/new-view",
  insertText: "",
  detail: "👁️ Create a saved view with sort & filter",
  isAction: true,
  commandId: Cmd.dbNewView,
  cmdFilter: Filter().pageIsDbIndex(),
  kind: 21,
  handler: handleNewViewCommand,
};

export const NEW_FIELD_SLASH_COMMAND: SlashCommand = {
  label: "/new-field",
  insertText: "",
  detail: "➕ Add a new field to the schema",
  isAction: true,
  commandId: Cmd.dbNewField,
  cmdFilter: Filter().pageIsDbIndex(),
  kind: 4,
  handler: handleNewFieldCommand,
};

export const DELETE_FIELD_SLASH_COMMAND: SlashCommand = {
  label: "/delete-field",
  insertText: "",
  detail: "🗑️ Remove a field from the schema",
  isAction: true,
  commandId: Cmd.dbDeleteField,
  cmdFilter: Filter().pageIsDbIndex(),
  kind: 4,
  handler: handleDeleteFieldCommand,
};

export const RENAME_FIELD_SLASH_COMMAND: SlashCommand = {
  label: "/rename-field",
  insertText: "",
  detail: "✏️ Rename a schema field across entries",
  isAction: true,
  commandId: Cmd.dbRenameField,
  cmdFilter: Filter().pageIsDbIndex(),
  kind: 4,
  handler: handleRenameFieldCommand,
};

export const SYNC_FIELD_ORDER_SLASH_COMMAND: SlashCommand = {
  label: "/sync-field-order",
  insertText: "",
  detail: "🔁 Sync entry field order to schema",
  isAction: true,
  commandId: Cmd.dbSyncFieldOrder,
  cmdFilter: Filter().pageIsDbIndex(),
  kind: 21,
  handler: handleSyncFieldOrderCommand,
};

export const TABLE_TO_DB_SLASH_COMMAND: SlashCommand = {
  label: "/table-to-db",
  insertText: "",
  detail: "📊 Create a new DB from markdown table under cursor",
  isAction: true,
  commandId: Cmd.dbTableToDatabase,
  kind: 21,
  handler: handleTableToDbCommand,
};

export const CSV_TO_DB_SLASH_COMMAND: SlashCommand = {
  label: "/csv-to-db",
  insertText: "",
  detail: "🧾 Create a new DB from CSV file",
  isAction: true,
  commandId: Cmd.dbCsvToDatabase,
  kind: 21,
  handler: handleCsvToDbCommand,
};

export const JSON_TO_DB_SLASH_COMMAND: SlashCommand = {
  label: "/json-to-db",
  insertText: "",
  detail: "🧾 Create a new DB from JSON file (array of objects)",
  isAction: true,
  commandId: Cmd.dbJsonToDatabase,
  kind: 21,
  handler: handleJsonToDbCommand,
};

export const REGEN_FROM_DB_SLASH_COMMAND: SlashCommand = {
  label: "/regen-from-db",
  insertText: "",
  detail: "🔄 Refresh the markdown table at the cursor from its source database",
  isAction: true,
  commandId: Cmd.dbRegenFromDb,
  kind: 21,
  handler: handleRegenFromDbCommand,
};

// ── Re-exports so existing `import { ... } from "./dbCommands"` keeps working ──

export { handleDatabaseCommand } from "./dbCreate";
export { handleDbEntryCommand } from "./dbEntryCreate";
export { promptForColumnValue } from "./dbColumnPrompt";
export {
  handleNewFieldCommand,
  handleDeleteFieldCommand,
  handleRenameFieldCommand,
  handleSyncFieldOrderCommand,
} from "./dbSchemaEdits";
export { handleNewViewCommand } from "./dbViewCreate";
export { handleTableToDbCommand, handleCsvToDbCommand, handleJsonToDbCommand } from "./dbTabularImport";
export { handleRegenFromDbCommand } from "./dbRegenTable";
export { logEntryAndPromptNew } from "./dbLogEntry";
