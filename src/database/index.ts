// ── Database module barrel ──────────────────────────────────────────
export {
  handleDatabaseCommand,
  handleDbEntryCommand,
  handleNewViewCommand,
  handleNewFieldCommand,
  handleDeleteFieldCommand,
  promptForColumnValue,
  parseSchemaFromFile,
  parsePropertyTable,
  cursorInDb,
  DbColumn,
  DbSchema,
} from "./database";
export { createDbCodeLensProvider, generateDbLenses } from "./dbCodeLens";
export { openDbWebview, refreshAllDbWebviews } from "./dbWebview";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import {
  DATABASE_SLASH_COMMAND,
  NEW_ENTRY_SLASH_COMMAND,
  NEW_VIEW_SLASH_COMMAND,
  NEW_FIELD_SLASH_COMMAND,
  DELETE_FIELD_SLASH_COMMAND,
} from "./dbCommands";
import { VIEW_DATABASE_SLASH_COMMAND } from "./dbWebview";

export const DATABASE_SLASH_COMMANDS: SlashCommand[] = [
  DATABASE_SLASH_COMMAND,
  VIEW_DATABASE_SLASH_COMMAND,
  NEW_ENTRY_SLASH_COMMAND,
  NEW_VIEW_SLASH_COMMAND,
  NEW_FIELD_SLASH_COMMAND,
  DELETE_FIELD_SLASH_COMMAND,
];
