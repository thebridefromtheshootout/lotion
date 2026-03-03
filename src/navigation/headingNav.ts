
import { Position, Range, Selection, TextEditorRevealType } from "../hostEditor/EditorTypes";
import type { QuickPickItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

// ── Heading navigation ────────────────────────────────────────────
//
// Jump to the next or previous markdown heading.

const HEADING_RE = /^#{1,6}\s/;

export async function jumpToNextHeading(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;
  const currentLine = hostEditor.getCursorPosition()!.line;

  for (let i = currentLine + 1; i < doc.lineCount; i++) {
    if (HEADING_RE.test(doc.lineAt(i).text)) {
      moveCursorTo(i);
      return;
    }
  }

  // Wrap around to beginning
  for (let i = 0; i <= currentLine; i++) {
    if (HEADING_RE.test(doc.lineAt(i).text)) {
      moveCursorTo(i);
      return;
    }
  }
}

export async function jumpToPrevHeading(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;
  const currentLine = hostEditor.getCursorPosition()!.line;

  for (let i = currentLine - 1; i >= 0; i--) {
    if (HEADING_RE.test(doc.lineAt(i).text)) {
      moveCursorTo(i);
      return;
    }
  }

  // Wrap around to end
  for (let i = doc.lineCount - 1; i >= currentLine; i--) {
    if (HEADING_RE.test(doc.lineAt(i).text)) {
      moveCursorTo(i);
      return;
    }
  }
}

/** Navigate to a heading via a quick pick list. */
export async function jumpToHeadingPicker(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;

  interface HeadingItem extends QuickPickItem {
    lineNumber: number;
  }

  const items: HeadingItem[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const match = doc.lineAt(i).text.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2];
      const indent = "  ".repeat(level - 1);
      items.push({
        label: `${indent}${text}`,
        description: `L${i + 1}`,
        lineNumber: i,
      });
    }
  }

  if (items.length === 0) {
    hostEditor.showInformation("No headings found.");
    return;
  }

  const pick = await hostEditor.showQuickPick(items, {
    placeHolder: "Jump to heading…",
  });

  if (pick) {
    moveCursorTo(pick.lineNumber);
  }
}

function moveCursorTo(line: number): void {
  const pos = new Position(line, 0);
  hostEditor.setSelection(new Selection(pos, pos));
  hostEditor.revealRange(new Range(pos, pos), TextEditorRevealType.InCenter);
}
