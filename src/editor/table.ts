// ── Table slash command + keybinding registry ─────────────────────
// This file used to contain every table command implementation. It now
// wires SlashCommand metadata to handlers in focused per-feature
// modules. Re-exports below preserve the existing public API so
// external consumers (core/cursorContext, core/slashCommands,
// database/dbTabularImport) keep working unchanged.

import type { SlashCommand } from "../core/slashCommands";
import { Cmd } from "../core/commands";
import { Filter } from "../core/cmdFilter";

import {
  handleTableCommand,
  handleAddRowsBelow,
  handleAddRowsAbove,
  handleAddColsRight,
  handleAddColsLeft,
  handleDeleteRow,
  handleDeleteCol,
} from "./tableEdit";
import {
  handleCopyColumn,
  handleCutColumn,
  handlePasteColumn,
} from "./tableColumnClipboard";
import {
  tableTabForward,
  tableTabBackward,
  tableJumpRowStart,
  tableJumpRowEnd,
  tableJumpColStart,
  tableJumpColEnd,
} from "./tableNav";
import {
  handleAlignTable,
  handleSortTable,
  handleTransposeTable,
} from "./tableTransform";

// ── Re-exports (canonical API for external imports) ────────────────

export { cursorInTable, getTableRange, parseRow, parseTable } from "./tableCore";
export { handleAlignTable } from "./tableTransform";
export {
  copyCurrentTableColumnToClipboard,
  parseTableColumnClipboard,
  pasteTableColumnAtCursor,
} from "./tableColumnClipboard";
export {
  tableTabForward,
  tableTabBackward,
  tableJumpRowStart,
  tableJumpRowEnd,
  tableJumpColStart,
  tableJumpColEnd,
};

// ── Slash command registry ─────────────────────────────────────────

export const TABLE_SLASH_COMMANDS: SlashCommand[] = [
  {
    label: "/table",
    insertText: "",
    detail: "📊 Insert a table",
    isAction: true,
    commandId: Cmd.insertTable,
    kind: 21,
    cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
    handler: handleTableCommand,
  },
  {
    label: "/rows-below",
    insertText: "",
    detail: "⬇️ Add rows below",
    isAction: true,
    commandId: Cmd.tableAddRowsBelow,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleAddRowsBelow,
  },
  {
    label: "/rows-above",
    insertText: "",
    detail: "⬆️ Add rows above",
    isAction: true,
    commandId: Cmd.tableAddRowsAbove,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleAddRowsAbove,
  },
  {
    label: "/cols-right",
    insertText: "",
    detail: "➡️ Add columns to the right",
    isAction: true,
    commandId: Cmd.tableAddColsRight,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleAddColsRight,
  },
  {
    label: "/cols-left",
    insertText: "",
    detail: "⬅️ Add columns to the left",
    isAction: true,
    commandId: Cmd.tableAddColsLeft,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleAddColsLeft,
  },
  {
    label: "/delete-row",
    insertText: "",
    detail: "🗑️ Delete current row",
    isAction: true,
    commandId: Cmd.tableDeleteRow,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleDeleteRow,
  },
  {
    label: "/delete-col",
    insertText: "",
    detail: "🗑️ Delete current column",
    isAction: true,
    commandId: Cmd.tableDeleteCol,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleDeleteCol,
  },
  {
    label: "/copy-column",
    insertText: "",
    detail: "📋 Copy current column",
    isAction: true,
    commandId: Cmd.tableCopyColumn,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleCopyColumn,
  },
  {
    label: "/cut-column",
    insertText: "",
    detail: "✂️ Cut current column",
    isAction: true,
    commandId: Cmd.tableCutColumn,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleCutColumn,
  },
  {
    label: "/paste-column",
    insertText: "",
    detail: "📥 Paste column from clipboard",
    isAction: true,
    commandId: Cmd.tablePasteColumn,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handlePasteColumn,
  },
  {
    label: "/align",
    insertText: "",
    detail: "↔️ Re-align table columns",
    isAction: true,
    commandId: Cmd.tableAlign,
    kind: 11,
    cmdFilter: Filter().cursorInTable(),
    handler: handleAlignTable,
  },
  {
    label: "/sort",
    insertText: "",
    detail: "🔤 Sort table by column",
    isAction: true,
    commandId: Cmd.tableSort,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleSortTable,
  },
  {
    label: "/transpose",
    insertText: "",
    detail: "🔄 Transpose table rows/cols",
    isAction: true,
    commandId: Cmd.tableTranspose,
    kind: 21,
    cmdFilter: Filter().cursorInTable(),
    handler: handleTransposeTable,
  },
];

/** Keybinding-only commands (Tab navigation) — not slash commands. */
export const tableKeybindingCommands: [string, () => Promise<void>][] = [
  [Cmd.tableTabForward, tableTabForward],
  [Cmd.tableTabBackward, tableTabBackward],
  [Cmd.tableJumpRowStart, tableJumpRowStart],
  [Cmd.tableJumpRowEnd, tableJumpRowEnd],
  [Cmd.tableJumpColStart, tableJumpColStart],
  [Cmd.tableJumpColEnd, tableJumpColEnd],
];
