
import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

// ── Table detection ────────────────────────────────────────────────
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

/**
 * Check if a line looks like a table row (starts and ends with |).
 */
function isTableRow(line: string): boolean {
  return TABLE_ROW_RE.test(line);
}

/**
 * Find the full range of the table surrounding the given line.
 * Returns undefined if the line is not inside a table.
 */
export function getTableRange(document: TextDocument, line: number): { start: number; end: number } | undefined {
  if (!isTableRow(document.lineAt(line).text)) {
    return undefined;
  }

  let start = line;
  while (start > 0 && isTableRow(document.lineAt(start - 1).text)) {
    start--;
  }

  let end = line;
  const lastLine = document.lineCount - 1;
  while (end < lastLine && isTableRow(document.lineAt(end + 1).text)) {
    end++;
  }

  return { start, end };
}

/**
 * Returns true if the cursor is currently inside a markdown table.
 */
export function cursorInTable(document: TextDocument, position: Position): boolean {
  return getTableRange(document, position.line) !== undefined;
}

// ── Table parsing & serialization ──────────────────────────────────
function parseRow(line: string): string[] {
  // Split by |, drop first and last empty segments
  const parts = line.split("|");
  return parts.slice(1, -1).map((c) => c.trim());
}

interface TableColumnClipboardPayload {
  __lotionTableColumn: true;
  header: string;
  rows: string[];
}

function serializeTable(headers: string[], rows: string[][], colWidths: number[]): string {
  const pad = (text: string, width: number) => text.padEnd(width);

  const headerLine = "| " + headers.map((h, i) => pad(h, colWidths[i])).join(" | ") + " |";
  const separatorLine = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const dataLines = rows.map((row) => "| " + row.map((cell, i) => pad(cell, colWidths[i])).join(" | ") + " |");

  return [headerLine, separatorLine, ...dataLines].join("\n");
}

function computeColWidths(headers: string[], rows: string[][]): number[] {
  return headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => Math.max(max, (row[i] || "").length), 0);
    return Math.max(h.length, maxData, 3); // minimum 3 for separator ---
  });
}

// ── Parse a full table from the document ───────────────────────────
function parseTable(
  document: TextDocument,
  range: { start: number; end: number },
): { headers: string[]; rows: string[][] } | undefined {
  if (range.end - range.start < 2) {
    return undefined; // need at least header + separator + 0 data rows
  }

  const headers = parseRow(document.lineAt(range.start).text);
  // Skip separator line (range.start + 1)
  const rows: string[][] = [];
  for (let i = range.start + 2; i <= range.end; i++) {
    rows.push(parseRow(document.lineAt(i).text));
  }

  return { headers, rows };
}

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

// ── Table editing commands ─────────────────────────────────────────
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

function replaceTable(
  document: TextDocument,
  range: { start: number; end: number },
  headers: string[],
  rows: string[][],
): Promise<void> {
  const colWidths = computeColWidths(headers, rows);
  const tableText = serializeTable(headers, rows, colWidths);

  const fullRange = new Range(
    new Position(range.start, 0),
    new Position(range.end, document.lineAt(range.end).text.length),
  );

  return hostEditor.replaceRange(fullRange, tableText);
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

// ── Delete rows ────────────────────────────────────────────────────

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

// ── Delete column ──────────────────────────────────────────────────

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

export async function copyCurrentTableColumnToClipboard(cut = false): Promise<boolean> {
  const document = hostEditor.getDocument();
  const position = hostEditor.getCursorPosition();
  if (!document || !position) {
    return false;
  }

  const range = getTableRange(document, position.line);
  if (!range) {
    return false;
  }
  const table = parseTable(document, range);
  if (!table) {
    return false;
  }

  const lineText = document.lineAt(position.line).text;
  const colIndex = getColumnAtCursor(lineText, position.character);
  if (colIndex >= table.headers.length) {
    return false;
  }

  const payload: TableColumnClipboardPayload = {
    __lotionTableColumn: true,
    header: table.headers[colIndex] ?? "",
    rows: table.rows.map((row) => row[colIndex] ?? ""),
  };
  await hostEditor.writeClipboardText(JSON.stringify(payload));

  if (!cut) {
    return true;
  }
  if (table.headers.length <= 1) {
    hostEditor.showWarning("Cannot cut the last column.");
    return false;
  }

  table.headers.splice(colIndex, 1);
  for (const row of table.rows) {
    row.splice(colIndex, 1);
  }

  await replaceTable(document, range, table.headers, table.rows);
  return true;
}

export function parseTableColumnClipboard(text: string): { header: string; rows: string[] } | undefined {
  try {
    const parsed = JSON.parse(text) as Partial<TableColumnClipboardPayload>;
    if (
      !parsed ||
      parsed.__lotionTableColumn !== true ||
      typeof parsed.header !== "string" ||
      !Array.isArray(parsed.rows) ||
      !parsed.rows.every((r) => typeof r === "string")
    ) {
      return undefined;
    }
    return { header: parsed.header, rows: parsed.rows };
  } catch {
    return undefined;
  }
}

export async function pasteTableColumnAtCursor(
  document: TextDocument,
  position: Position,
  payload: { header: string; rows: string[] },
): Promise<boolean> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return false;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return false;
  }
  const table = parseTable(document, range);
  if (!table) {
    return false;
  }

  const lineText = document.lineAt(position.line).text;
  const currentCol = Math.min(getColumnAtCursor(lineText, position.character), table.headers.length - 1);
  const insertAt = currentCol + 1;

  while (table.rows.length < payload.rows.length) {
    table.rows.push(Array.from({ length: table.headers.length }, () => ""));
  }

  table.headers.splice(insertAt, 0, payload.header || "Col");
  for (let i = 0; i < table.rows.length; i++) {
    const value = i < payload.rows.length ? payload.rows[i] : "";
    table.rows[i].splice(insertAt, 0, value);
  }

  await replaceTable(document, range, table.headers, table.rows);
  return true;
}

// ── Which column is the cursor in? ────────────────────────────────
function getColumnAtCursor(lineText: string, charPos: number): number {
  let col = -1; // before first |
  for (let i = 0; i < charPos && i < lineText.length; i++) {
    if (lineText[i] === "|") {
      col++;
    }
  }
  return Math.max(0, col);
}

// ── Tab between table cells ────────────────────────────────────────

/**
 * Return the character range (start, end) of the content of column `col`
 * within a table row string. Columns are 0-indexed.
 */
function getCellRange(lineText: string, col: number): { start: number; end: number } | undefined {
  let pipeCount = -1;
  let cellStart = -1;

  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === "|") {
      pipeCount++;
      if (pipeCount === col) {
        cellStart = i + 1;
      } else if (pipeCount === col + 1) {
        // Trim leading/trailing spaces within the cell for selection
        let s = cellStart;
        let e = i;
        while (s < e && lineText[s] === " ") {
          s++;
        }
        while (e > s && lineText[e - 1] === " ") {
          e--;
        }
        return { start: s, end: e };
      }
    }
  }
  return undefined;
}

/** Move the cursor (and select content) to the next cell in the table. */
export async function tableTabForward(): Promise<void> {
  const doc = hostEditor.getDocument();
  const pos = hostEditor.getCursorPosition();
  if (!doc || !pos) {
    return;
  }

  const lineText = doc.lineAt(pos.line).text;
  const range = getTableRange(doc, pos.line);
  if (!range) {
    return;
  }

  const curCol = getColumnAtCursor(lineText, pos.character);
  const numCols = parseRow(lineText).length;

  let nextLine = pos.line;
  let nextCol = curCol + 1;

  if (nextCol >= numCols) {
    // Wrap to first column of next data row
    nextCol = 0;
    nextLine = pos.line + 1;

    // Skip separator row
    if (nextLine === range.start + 1) {
      nextLine++;
    }

    if (nextLine > range.end) {
      // Past the last row — stay put
      return;
    }
  }

  selectCell(nextLine, nextCol);
}

/** Move the cursor (and select content) to the previous cell in the table. */
export async function tableTabBackward(): Promise<void> {
  const doc = hostEditor.getDocument();
  const pos = hostEditor.getCursorPosition();
  if (!doc || !pos) {
    return;
  }

  const range = getTableRange(doc, pos.line);
  if (!range) {
    return;
  }

  const lineText = doc.lineAt(pos.line).text;
  const curCol = getColumnAtCursor(lineText, pos.character);
  const numCols = parseRow(lineText).length;

  let prevLine = pos.line;
  let prevCol = curCol - 1;

  if (prevCol < 0) {
    // Wrap to last column of previous data row
    prevLine = pos.line - 1;

    // Skip separator row
    if (prevLine === range.start + 1) {
      prevLine--;
    }

    if (prevLine < range.start) {
      return;
    }

    const prevText = doc.lineAt(prevLine).text;
    prevCol = parseRow(prevText).length - 1;
  }

  selectCell(prevLine, prevCol);
}

/** Move cursor to the first cell in the current row. */
export async function tableJumpRowStart(): Promise<void> {
  const doc = hostEditor.getDocument();
  const pos = hostEditor.getCursorPosition();
  if (!doc || !pos) {
    return;
  }

  const range = getTableRange(doc, pos.line);
  if (!range) {
    return;
  }

  selectCell(pos.line, 0);
}

/** Move cursor to the last cell in the current row. */
export async function tableJumpRowEnd(): Promise<void> {
  const doc = hostEditor.getDocument();
  const pos = hostEditor.getCursorPosition();
  if (!doc || !pos) {
    return;
  }

  const range = getTableRange(doc, pos.line);
  if (!range) {
    return;
  }

  const lineText = doc.lineAt(pos.line).text;
  const numCols = parseRow(lineText).length;
  selectCell(pos.line, numCols - 1);
}

/** Move cursor to the first row (header) in the current column. */
export async function tableJumpColStart(): Promise<void> {
  const doc = hostEditor.getDocument();
  const pos = hostEditor.getCursorPosition();
  if (!doc || !pos) {
    return;
  }

  const range = getTableRange(doc, pos.line);
  if (!range) {
    return;
  }

  const lineText = doc.lineAt(pos.line).text;
  const curCol = getColumnAtCursor(lineText, pos.character);
  selectCell(range.start, curCol);
}

/** Move cursor to the last row in the current column. */
export async function tableJumpColEnd(): Promise<void> {
  const doc = hostEditor.getDocument();
  const pos = hostEditor.getCursorPosition();
  if (!doc || !pos) {
    return;
  }

  const range = getTableRange(doc, pos.line);
  if (!range) {
    return;
  }

  const lineText = doc.lineAt(pos.line).text;
  const curCol = getColumnAtCursor(lineText, pos.character);
  selectCell(range.end, curCol);
}

/** Move cursor to the given cell in table. If cursor was at cell end, keep at end; otherwise move to start. */
function selectCell(lineNum: number, col: number): void {
  const lineText = hostEditor.getLineText(lineNum);
  const cellRange = getCellRange(lineText, col);
  if (!cellRange) {
    return;
  }

  const currentPos = hostEditor.getCursorPosition();
  let targetPos: Position;

  // Check if cursor was at cell end (ignoring trailing whitespace)
  if (currentPos && currentPos.line === lineNum) {
    const cellContent = lineText.substring(cellRange.start, cellRange.end);
    const cellEndWithoutWhitespace = cellRange.start + cellContent.trimEnd().length;
    
    if (currentPos.character >= cellEndWithoutWhitespace) {
      targetPos = new Position(lineNum, cellRange.end);
    } else {
      targetPos = new Position(lineNum, cellRange.start);
    }
  } else {
    targetPos = new Position(lineNum, cellRange.start);
  }

  hostEditor.setSelection(new Selection(targetPos, targetPos));
  hostEditor.revealRange(new Range(targetPos, targetPos));
}

// ── Align / reformat table ─────────────────────────────────────────

/** Re-align all columns in the table under the cursor. */
export async function handleAlignTable(document: TextDocument, position: Position): Promise<void> {
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

  // Capture cursor position info BEFORE alignment
  const cursorLine = position.line;
  const lineText = document.lineAt(cursorLine).text;
  const cursorCol = getColumnAtCursor(lineText, position.character);
  const cellRange = getCellRange(lineText, cursorCol);
  
  // Determine if cursor was at cell end (ignoring whitespace) BEFORE alignment
  let cursorAtEnd = false;
  if (cellRange) {
    const cellContent = lineText.substring(cellRange.start, cellRange.end);
    const cellEndWithoutWhitespace = cellRange.start + cellContent.trimEnd().length;
    cursorAtEnd = position.character >= cellEndWithoutWhitespace;
  }

  const rowOffset = cursorLine - range.start; // 0 = header, 1 = separator, 2+ = data rows

  await replaceTable(document, range, table.headers, table.rows);

  // Restore cursor to the same cell with remembered position
  selectCellWithMemory(range.start + rowOffset, cursorCol, cursorAtEnd);
}

/** Move cursor to the given cell, with memory of whether it should be at start or end. */
function selectCellWithMemory(lineNum: number, col: number, atEnd: boolean): void {
  const lineText = hostEditor.getLineText(lineNum);
  const cellRange = getCellRange(lineText, col);
  if (!cellRange) {
    return;
  }

  const targetPos = atEnd ? new Position(lineNum, cellRange.end) : new Position(lineNum, cellRange.start);
  hostEditor.setSelection(new Selection(targetPos, targetPos));
  hostEditor.revealRange(new Range(targetPos, targetPos));
}

// ── Sort table by column ───────────────────────────────────────────

/** Prompt user to pick a column, then sort data rows by that column. */
export async function handleSortTable(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const range = getTableRange(document, position.line);
  if (!range) {
    hostEditor.showWarning("Place cursor inside a table to sort.");
    return;
  }

  const table = parseTable(document, range);
  if (!table || table.rows.length === 0) {
    hostEditor.showWarning("Table has no data rows to sort.");
    return;
  }

  // Let user pick a column
  const columnPicks = table.headers.map((h, i) => ({
    label: h || `Column ${i + 1}`,
    index: i,
  }));

  const colPick = await hostEditor.showQuickPick(columnPicks, {
    placeHolder: "Sort by which column?",
  });
  if (!colPick) {
    return;
  }

  // Ask sort direction
  const dirPick = await hostEditor.showQuickPick(
    [
      { label: "Ascending (A→Z / 0→9)", value: "asc" as const },
      { label: "Descending (Z→A / 9→0)", value: "desc" as const },
    ],
    { placeHolder: "Sort direction" },
  );
  if (!dirPick) {
    return;
  }

  const colIdx = colPick.index;
  const dir = dirPick.value === "asc" ? 1 : -1;

  table.rows.sort((a, b) => {
    const va = (a[colIdx] || "").trim();
    const vb = (b[colIdx] || "").trim();

    // Try numeric comparison first
    const na = Number(va);
    const nb = Number(vb);
    if (!isNaN(na) && !isNaN(nb)) {
      return (na - nb) * dir;
    }

    return va.localeCompare(vb, undefined, { sensitivity: "base" }) * dir;
  });

  await replaceTable(document, range, table.headers, table.rows);
}

// ── Transpose table ────────────────────────────────────────────

/** Swap rows and columns in the table under the cursor. */
export async function handleTransposeTable(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const range = getTableRange(document, position.line);
  if (!range) {
    hostEditor.showWarning("Place cursor inside a table to transpose.");
    return;
  }

  const table = parseTable(document, range);
  if (!table) {
    return;
  }

  // Build the full grid: headers + data rows
  const allRows = [table.headers, ...table.rows];
  const numRows = allRows.length;
  const numCols = table.headers.length;

  // Transpose: new table has numCols rows and numRows columns
  const tHeaders: string[] = [];
  for (let r = 0; r < numRows; r++) {
    tHeaders.push(allRows[r][0] || "");
  }

  const tRows: string[][] = [];
  for (let c = 1; c < numCols; c++) {
    const row: string[] = [];
    for (let r = 0; r < numRows; r++) {
      row.push(allRows[r][c] || "");
    }
    tRows.push(row);
  }

  await replaceTable(document, range, tHeaders, tRows);
}

// ── Module exports ─────────────────────────────────────────────────

import type { SlashCommand } from "../core/slashCommands";
import { Cmd } from "../core/commands";

/** All table slash commands - single source of truth for UI and handlers */
export const TABLE_SLASH_COMMANDS: SlashCommand[] = [
  {
    label: "/table",
    insertText: "",
    detail: "📊 Insert a table",
    isAction: true,
    commandId: Cmd.insertTable,
    kind: 21,
    handler: handleTableCommand,
  },
  {
    label: "/rows-below",
    insertText: "",
    detail: "⬇️ Add rows below",
    isAction: true,
    commandId: Cmd.tableAddRowsBelow,
    kind: 21,
    when: cursorInTable,
    handler: handleAddRowsBelow,
  },
  {
    label: "/rows-above",
    insertText: "",
    detail: "⬆️ Add rows above",
    isAction: true,
    commandId: Cmd.tableAddRowsAbove,
    kind: 21,
    when: cursorInTable,
    handler: handleAddRowsAbove,
  },
  {
    label: "/cols-right",
    insertText: "",
    detail: "➡️ Add columns to the right",
    isAction: true,
    commandId: Cmd.tableAddColsRight,
    kind: 21,
    when: cursorInTable,
    handler: handleAddColsRight,
  },
  {
    label: "/cols-left",
    insertText: "",
    detail: "⬅️ Add columns to the left",
    isAction: true,
    commandId: Cmd.tableAddColsLeft,
    kind: 21,
    when: cursorInTable,
    handler: handleAddColsLeft,
  },
  {
    label: "/delete-row",
    insertText: "",
    detail: "🗑️ Delete current row",
    isAction: true,
    commandId: Cmd.tableDeleteRow,
    kind: 21,
    when: cursorInTable,
    handler: handleDeleteRow,
  },
  {
    label: "/delete-col",
    insertText: "",
    detail: "🗑️ Delete current column",
    isAction: true,
    commandId: Cmd.tableDeleteCol,
    kind: 21,
    when: cursorInTable,
    handler: handleDeleteCol,
  },
  {
    label: "/align",
    insertText: "",
    detail: "↔️ Re-align table columns",
    isAction: true,
    commandId: Cmd.tableAlign,
    kind: 11,
    when: cursorInTable,
    handler: handleAlignTable,
  },
  {
    label: "/sort",
    insertText: "",
    detail: "🔤 Sort table by column",
    isAction: true,
    commandId: Cmd.tableSort,
    kind: 21,
    when: cursorInTable,
    handler: handleSortTable,
  },
  {
    label: "/transpose",
    insertText: "",
    detail: "🔄 Transpose table rows/cols",
    isAction: true,
    commandId: Cmd.tableTranspose,
    kind: 21,
    when: cursorInTable,
    handler: handleTransposeTable,
  },
];

/** Keybinding-only commands (Tab navigation) - not slash commands */
export const tableKeybindingCommands: [string, () => Promise<void>][] = [
  [Cmd.tableTabForward, tableTabForward],
  [Cmd.tableTabBackward, tableTabBackward],
  [Cmd.tableJumpRowStart, tableJumpRowStart],
  [Cmd.tableJumpRowEnd, tableJumpRowEnd],
  [Cmd.tableJumpColStart, tableJumpColStart],
  [Cmd.tableJumpColEnd, tableJumpColEnd],
];
