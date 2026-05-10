import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import {
  getCellRange,
  getColumnAtCursor,
  getTableRange,
  parseTable,
  replaceTable,
} from "./tableCore";

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

// ── Transpose table ────────────────────────────────────────────────

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
