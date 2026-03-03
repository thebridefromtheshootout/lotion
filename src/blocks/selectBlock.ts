
import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

// ── Select current block ───────────────────────────────────────────
//
// Selects the entire "block" containing the cursor. A block is a
// contiguous group of non-empty lines, a fenced code block, or a
// table.

export function selectBlock(): void {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const document = hostEditor.getDocument()!;
  const cursorLine = hostEditor.getCursorPosition()!.line;
  const { start, end } = getBlockBounds(document, cursorLine);

  const range = new Range(new Position(start, 0), new Position(end, document.lineAt(end).text.length));

  hostEditor.setSelection(new Selection(range.start, range.end));
  hostEditor.revealRange(range);
}

function getBlockBounds(document: TextDocument, line: number): { start: number; end: number } {
  // Check for fenced code block
  const fenced = getFencedBounds(document, line);
  if (fenced) {
    return fenced;
  }

  // Check for <details> block
  const details = getDetailsBounds(document, line);
  if (details) {
    return details;
  }

  // Paragraph: contiguous non-empty lines
  let start = line;
  while (start > 0 && document.lineAt(start - 1).text.trim() !== "") {
    start--;
  }

  let end = line;
  while (end < document.lineCount - 1 && document.lineAt(end + 1).text.trim() !== "") {
    end++;
  }

  return { start, end };
}

function getDetailsBounds(document: TextDocument, line: number): { start: number; end: number } | undefined {
  // Search upward for <details>
  let start = -1;
  for (let i = line; i >= 0; i--) {
    if (document.lineAt(i).text.trimStart().toLowerCase().startsWith("<details")) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    return undefined;
  }

  // Search downward for </details>
  let end = -1;
  for (let i = start + 1; i < document.lineCount; i++) {
    if (document.lineAt(i).text.trimStart().toLowerCase().startsWith("</details>")) {
      end = i;
      break;
    }
  }
  if (end < 0) {
    return undefined;
  }

  // Verify cursor is inside this block
  if (line >= start && line <= end) {
    return { start, end };
  }
  return undefined;
}

function getFencedBounds(document: TextDocument, line: number): { start: number; end: number } | undefined {
  let fenceStart = -1;
  for (let i = line; i >= 0; i--) {
    if (/^```/.test(document.lineAt(i).text.trim())) {
      fenceStart = i;
      break;
    }
  }
  if (fenceStart < 0) {
    return undefined;
  }

  let count = 0;
  for (let i = 0; i < fenceStart; i++) {
    if (/^```/.test(document.lineAt(i).text.trim())) {
      count++;
    }
  }

  if (count % 2 !== 0) {
    return undefined;
  }

  let fenceEnd = -1;
  for (let i = fenceStart + 1; i < document.lineCount; i++) {
    if (/^```\s*$/.test(document.lineAt(i).text.trim())) {
      fenceEnd = i;
      break;
    }
  }

  if (fenceEnd >= 0 && line >= fenceStart && line <= fenceEnd) {
    return { start: fenceStart, end: fenceEnd };
  }

  return undefined;
}
