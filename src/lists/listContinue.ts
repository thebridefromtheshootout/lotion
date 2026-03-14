
import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import type { TextLine } from "../hostEditor/EditorTypes";
import { hostEditor, OpType, type EditOp } from "../hostEditor/HostingEditor";
import { collectOrderedList, renumberEdits, applyRenumberEdits } from "./listModel";
import { Regex } from "../core/regex";

/**
 * Auto-continue markdown lists on Enter.
 *
 * Behaviour:
 * - If the current line matches a list marker followed by content, pressing
 *   Enter inserts a new line with the same marker (incrementing numbered lists).
 * - If the current line is an *empty* list item (marker only, no content),
 *   pressing Enter removes the marker and exits the list.
 */
export async function handleListContinue(): Promise<void> {
  const document = hostEditor.getDocument();
  if (!document) {
    // Fall back to normal Enter
    await hostEditor.executeCommand("type", { text: "\n" });
    return;
  }

  const selection = hostEditor.getSelection()!;

  // Only act on single cursor with no selection range
  if (!selection.isEmpty) {
    await hostEditor.executeCommand("type", { text: "\n" });
    return;
  }

  const line = document.lineAt(selection.active.line);
  const lineText = line.text;

  // ── Pattern definitions ────────────────────────────────────────
  // Blockquote:   `> ` or `>> ` (nested)
  // Checkbox:     `  - [ ] ` or `  - [x] `
  // Unordered:    `  - ` or `  * ` or `  + `
  // Ordered:      `  1. ` `  2) ` etc.
  const blockquoteRe = Regex.blockquotePrefixWithContent;
  const checkboxRe = Regex.checkboxWithContent;
  const unorderedRe = Regex.unorderedListWithContent;
  const orderedRe = Regex.orderedListWithContent;

  let match: RegExpMatchArray | null;

  // Check blockquote first (before list patterns, since > can contain lists)
  if ((match = lineText.match(blockquoteRe))) {
    const prefix = match[1];
    const content = match[2];

    if (content.trim().length === 0) {
      // Empty blockquote → remove prefix, exit blockquote
      await clearLine(line);
    } else {
      await insertBelow(selection, prefix);
    }
    return;
  }

  if ((match = lineText.match(checkboxRe))) {
    const marker = match[1];
    const content = match[2];

    if (content.trim().length === 0) {
      // Empty checkbox item → remove marker, exit list
      await clearLine(line);
    } else {
      // Continue with unchecked checkbox
      const indent = marker.match(Regex.lineIndent)?.[1] ?? "";
      await insertBelow(selection, `${indent}- [ ] `);
    }
    return;
  }

  if ((match = lineText.match(orderedRe))) {
    const indent = match[1];
    const numStr = match[2];
    const num = parseInt(numStr, 10);
    const sep = match[3]; // `. ` or `) `
    const content = match[4];

    // Cursor before (or inside) the number prefix → plain Enter
    const prefixEnd = indent.length + numStr.length + sep.length;
    if (selection.active.character < prefixEnd) {
      await hostEditor.executeCommand("type", { text: "\n" });
      return;
    }

    if (content.trim().length === 0) {
      // Empty item — behaviour depends on position in the list.
      const cursorLine = selection.active.line;
      const items = collectOrderedList(document, cursorLine);
      const nodeIdx = items.findIndex((n) => n.line === cursorLine);
      const isLast = nodeIdx === items.length - 1;

      if (isLast) {
        // Last item in the list → remove the empty marker and exit.
        await clearLine(line);

        if (nodeIdx >= 0) {
          // After clearLine, lines after cursorLine shifted up by 1.
          const remaining = items.filter((_, i) => i !== nodeIdx);
          for (const n of remaining) {
            if (n.line > cursorLine) {
              n.line -= 1;
            }
          }
          const startNum = nodeIdx === 0 ? 1 : remaining[nodeIdx - 1].num + 1;
          const edits = renumberEdits(hostEditor.getDocument()!, remaining, nodeIdx, startNum);
          await applyRenumberEdits(edits);
        }
      } else {
        // Not the last item → treat like addition (add N+1. below).
        await insertBelow(selection, `${indent}${num + 1}${sep}`);

        if (nodeIdx >= 0) {
          // After insertBelow, lines after cursorLine shifted down by 1.
          for (const n of items) {
            if (n.line > cursorLine) {
              n.line += 1;
            }
          }
          const edits = renumberEdits(hostEditor.getDocument()!, items, nodeIdx + 1, num + 2);
          await applyRenumberEdits(edits);
        }
      }
    } else {
      // Addition.  Abstract the list, find this node, insert after it,
      // renumber everything from the insertion point onward.
      const cursorLine = selection.active.line;
      const items = collectOrderedList(document, cursorLine);
      const nodeIdx = items.findIndex((n) => n.line === cursorLine);

      await insertBelow(selection, `${indent}${num + 1}${sep}`);

      if (nodeIdx >= 0) {
        // After insertBelow the document shifted: lines after cursorLine moved down by 1.
        // Adjust subsequent nodes and renumber from the one after our new line.
        for (const n of items) {
          if (n.line > cursorLine) {
            n.line += 1;
          }
        }
        // Items from nodeIdx+1 onward need renumbering, starting at num+2
        const edits = renumberEdits(hostEditor.getDocument()!, items, nodeIdx + 1, num + 2);
        await applyRenumberEdits(edits);
      }
    }
    return;
  }

  if ((match = lineText.match(unorderedRe))) {
    const marker = match[1];
    const content = match[2];

    if (content.trim().length === 0) {
      await clearLine(line);
    } else {
      await insertBelow(selection, marker);
    }
    return;
  }

  // No list detected → normal Enter
  await hostEditor.executeCommand("type", { text: "\n" });
}

// ── Helpers ────────────────────────────────────────────────────────

/** Insert a new line below the cursor with the given prefix text. */
async function insertBelow(selection: Selection, prefix: string): Promise<void> {
  const pos = selection.active;
  const lineEnd = hostEditor.getLine(pos.line).range.end;

  // If cursor is mid-line, split the line content
  const afterCursor = hostEditor.getDocumentText(new Range(pos, lineEnd));

  await hostEditor.batchEdit([
    { type: OpType.Delete, range: new Range(pos, lineEnd) },
    { type: OpType.Insert, position: pos, text: `\n${prefix}${afterCursor}` },
  ]);

  // Move cursor to end of the new prefix
  const newLine = pos.line + 1;
  const newChar = prefix.length;
  const newPos = new Position(newLine, newChar);
  hostEditor.setSelection(new Selection(newPos, newPos));
}

/** Clear the current line (remove the dangling list marker). */
async function clearLine(line: TextLine): Promise<void> {
  const doc = hostEditor.getDocument()!;
  let op: EditOp;
  if (line.lineNumber < doc.lineCount - 1) {
    // Delete from start of current line to start of next line (removes line + \n)
    const nextStart = doc.lineAt(line.lineNumber + 1).range.start;
    op = { type: OpType.Delete, range: new Range(line.range.start, nextStart) };
  } else if (line.lineNumber > 0) {
    // Last line — delete from end of previous line to end of current line
    const prevEnd = doc.lineAt(line.lineNumber - 1).range.end;
    op = { type: OpType.Delete, range: new Range(prevEnd, line.range.end) };
  } else {
    // Only line — just clear content
    op = { type: OpType.Replace, range: line.range, text: "" };
  }
  await hostEditor.batchEdit([op]);
}
