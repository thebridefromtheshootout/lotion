import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import {
  computeColWidths,
  getColumnAtCursor,
  getTableRange,
  parseTable,
  replaceTable,
  serializeTable,
} from "./tableCore";

// ── /table handler — create a new table ────────────────────────────

export async function handleTableCommand(document: TextDocument, position: Position) {
  const input = await hostEditor.showInputBox({
    prompt: "Table dimensions (columns x rows)",
    placeHolder: "3x3",
    validateInput: (value) => {
      if (!/^\d+x\d+$/.test(value.trim())) {
        return "Use format: COLSxROWS (e.g. 3x5)";
      }
      const [cols, rows] = value.trim().split("x").map(Number);
      if (cols < 1 || rows < 1) {
        return "Both columns and rows must be at least 1";
      }
      if (cols > 100 || rows > 1000) {
        return "Maximum 100 columns and 1000 rows";
      }
      return undefined;
    },
  });

  if (!input) {
    return;
  }

  const [cols, rows] = input.trim().split("x").map(Number);

  const headers = Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
  const dataRows = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  const colWidths = computeColWidths(headers, dataRows);
  const tableText = serializeTable(headers, dataRows, colWidths);

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const triggerRange = new Range(position.translate(0, -1), position);
  await hostEditor.replaceRange(triggerRange, tableText);
}

// ── Add/delete row/col commands ────────────────────────────────────

async function promptCount(direction: string): Promise<number | undefined> {
  const input = await hostEditor.showInputBox({
    prompt: `How many ${direction}?`,
    value: "1",
    valueSelection: [0, 1],
    validateInput: (value) => {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1) {
        return "Enter a positive integer";
      }
      if (n > 100) {
        return "Maximum 100";
      }
      return undefined;
    },
  });
  if (!input) {
    return undefined;
  }
  return parseInt(input, 10);
}

export async function handleAddRowsBelow(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return;
  }
  const table = parseTable(document, range);
  if (!table) {
    return;
  }

  const count = await promptCount("rows to add below");
  if (!count) {
    return;
  }

  // Find which data row the cursor is on
  const cursorLine = position.line;
  const dataIndex = cursorLine - range.start - 2; // subtract header + separator
  const insertAt = Math.max(0, dataIndex + 1);

  const emptyRow = () => Array.from({ length: table.headers.length }, () => "");
  const newRows = Array.from({ length: count }, emptyRow);
  table.rows.splice(insertAt, 0, ...newRows);

  await replaceTable(document, range, table.headers, table.rows);
}

export async function handleAddRowsAbove(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return;
  }
  const table = parseTable(document, range);
  if (!table) {
    return;
  }

  const count = await promptCount("rows to add above");
  if (!count) {
    return;
  }

  const cursorLine = position.line;
  const dataIndex = cursorLine - range.start - 2;
  const insertAt = Math.max(0, dataIndex);

  const emptyRow = () => Array.from({ length: table.headers.length }, () => "");
  const newRows = Array.from({ length: count }, emptyRow);
  table.rows.splice(insertAt, 0, ...newRows);

  await replaceTable(document, range, table.headers, table.rows);
}

export async function handleAddColsRight(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return;
  }
  const table = parseTable(document, range);
  if (!table) {
    return;
  }

  const count = await promptCount("columns to add to the right");
  if (!count) {
    return;
  }

  // Determine which column the cursor is in
  const lineText = document.lineAt(position.line).text;
  const charPos = position.character;
  const colIndex = getColumnAtCursor(lineText, charPos);
  const insertAt = colIndex + 1;

  for (let c = 0; c < count; c++) {
    table.headers.splice(insertAt + c, 0, `Col`);
    for (const row of table.rows) {
      row.splice(insertAt + c, 0, "");
    }
  }

  await replaceTable(document, range, table.headers, table.rows);
}

export async function handleAddColsLeft(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return;
  }
  const table = parseTable(document, range);
  if (!table) {
    return;
  }

  const count = await promptCount("columns to add to the left");
  if (!count) {
    return;
  }

  const lineText = document.lineAt(position.line).text;
  const charPos = position.character;
  const colIndex = getColumnAtCursor(lineText, charPos);
  const insertAt = colIndex;

  for (let c = 0; c < count; c++) {
    table.headers.splice(insertAt + c, 0, `Col`);
    for (const row of table.rows) {
      row.splice(insertAt + c, 0, "");
    }
  }

  await replaceTable(document, range, table.headers, table.rows);
}

export async function handleDeleteRow(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return;
  }
  const table = parseTable(document, range);
  if (!table) {
    return;
  }

  const cursorLine = position.line;
  const dataIndex = cursorLine - range.start - 2;

  // Don't delete the header or separator row
  if (dataIndex < 0) {
    hostEditor.showWarning("Cannot delete the header row.");
    return;
  }

  if (dataIndex >= table.rows.length) {
    return;
  }

  if (table.rows.length <= 1) {
    hostEditor.showWarning("Cannot delete the last row.");
    return;
  }

  table.rows.splice(dataIndex, 1);
  await replaceTable(document, range, table.headers, table.rows);
}

export async function handleDeleteCol(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return;
  }
  const table = parseTable(document, range);
  if (!table) {
    return;
  }

  if (table.headers.length <= 1) {
    hostEditor.showWarning("Cannot delete the last column.");
    return;
  }

  const lineText = document.lineAt(position.line).text;
  const colIndex = getColumnAtCursor(lineText, position.character);

  if (colIndex >= table.headers.length) {
    return;
  }

  table.headers.splice(colIndex, 1);
  for (const row of table.rows) {
    row.splice(colIndex, 1);
  }

  await replaceTable(document, range, table.headers, table.rows);
}
