import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { getCellRange, getColumnAtCursor, getTableRange, parseRow } from "./tableCore";

// ── Tab between table cells ────────────────────────────────────────

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

// ── Cell selection ─────────────────────────────────────────────────

/** Move cursor to the given cell. If cursor was at cell end, keep at end; otherwise move to start. */
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
