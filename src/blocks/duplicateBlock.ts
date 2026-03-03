
import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { duplicateCommentMarkers } from "../editor/comments";
import { duplicateProcessorMarkers, PROC_START_RE } from "../editor/processor";

// ── Duplicate block ────────────────────────────────────────────────
//
// Duplicates the current "block" below. Block means:
//   - If text is selected: duplicate the selection
//   - If cursor is on a heading: duplicate heading + section
//   - Otherwise: duplicate the current contiguous paragraph

const HEADING_RE = /^(#{1,6})\s/;

export async function handleDuplicateBlock(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const doc = hostEditor.getDocument()!;
  const selection = hostEditor.getSelection()!;

  let startLine: number;
  let endLine: number;

  if (!selection.isEmpty) {
    // Duplicate the selected lines (extend to full lines)
    startLine = selection.start.line;
    endLine = selection.end.line;
  } else {
    const cursorLine = selection.active.line;
    const range = getBlockRange(doc, cursorLine);
    startLine = range.startLine;
    endLine = range.endLine;
  }

  // Gather the text to duplicate
  const lines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    lines.push(doc.lineAt(i).text);
  }
  let blockText = lines.join("\n");

  // Duplicate comment markers: replace old IDs with fresh ones and
  // duplicate the comment entries in comments.json
  const docPath = doc.uri.fsPath;
  blockText = duplicateCommentMarkers(blockText, docPath);

  // Duplicate processor markers: replace old UUIDs with fresh ones and
  // duplicate the processor entries in processors.json
  blockText = duplicateProcessorMarkers(blockText, docPath);

  // Insert after the block
  const insertPos = new Position(endLine, doc.lineAt(endLine).text.length);
  await hostEditor.insertAt(insertPos, "\n" + blockText);

  // Move cursor to the start of the duplicated block
  const newStartLine = endLine + 1;
  const newPos = new Position(newStartLine, 0);
  hostEditor.setSelection(new Selection(newPos, newPos));
  hostEditor.revealRange(new Range(newPos, newPos));
}

function getBlockRange(doc: TextDocument, cursorLine: number): { startLine: number; endLine: number } {
  const lineText = doc.lineAt(cursorLine).text;
  const headingMatch = lineText.match(HEADING_RE);

  if (headingMatch) {
    const level = headingMatch[1].length;
    const startLine = cursorLine;
    let endLine = doc.lineCount - 1;

    for (let i = startLine + 1; i < doc.lineCount; i++) {
      const m = doc.lineAt(i).text.match(HEADING_RE);
      if (m && m[1].length <= level) {
        endLine = i - 1;
        break;
      }
    }

    // Trim trailing blank lines
    while (endLine > startLine && doc.lineAt(endLine).text.trim() === "") {
      endLine--;
    }

    return { startLine, endLine };
  }

  // Paragraph — contiguous non-blank lines
  let startLine = cursorLine;
  let endLine = cursorLine;

  while (startLine > 0 && doc.lineAt(startLine - 1).text.trim() !== "") {
    startLine--;
  }
  while (endLine < doc.lineCount - 1 && doc.lineAt(endLine + 1).text.trim() !== "") {
    endLine++;
  }

  return { startLine, endLine };
}
