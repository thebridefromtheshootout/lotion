
import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { collectOrderedList, renumberEdits, applyRenumberEdits } from "./listModel";
import { Regex } from "../core/regex";

// ── Smart list indent / outdent ────────────────────────────────────
//
// Tab indents list items, Shift+Tab outdents.
// Indent width is derived from the editor's `tabSize` setting.
// Only acts when cursor is on a list line; otherwise falls through
// to default Tab behavior.
//
// Special ordered-list conversions:
//   Tab on OL prefix  → indent and convert to `- `, renumber outer list
//   Shift+Tab on `- ` inside a numbered list → convert back to `N. `, renumber

const LIST_RE = Regex.listItem;
const OL_PREFIX_RE = Regex.orderedListPrefix;
const UNORDERED_RE = Regex.unorderedListPrefix;

/** Return the indent unit (in spaces) for the current editor. */
function getIndentSize(): number {
  const tabSize = hostEditor.getTabSize();
  return tabSize > 0 ? tabSize : 2;
}

export async function indentListItem(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    await hostEditor.executeCommand("tab");
    return;
  }

  const document = hostEditor.getDocument()!;
  const selections = hostEditor.getSelections();

  // Check if all selections are on list lines
  const allOnList = selections.every((s) => {
    for (let i = s.start.line; i <= s.end.line; i++) {
      if (LIST_RE.test(document.lineAt(i).text)) {
        return true;
      }
    }
    return false;
  });

  if (!allOnList) {
    await hostEditor.executeCommand("tab");
    return;
  }

  // Special case: single cursor in the prefix area of an ordered item
  // (e.g. `3. ` or `3. When…` with cursor before "When")
  // → convert to indented unordered `  - text` and renumber the outer list
  // Triggers when:
  //   1) Between cursor and line start is only whitespace, OR
  //   2) Cursor is at or before the first character following `N. `
  if (selections.length === 1 && selections[0].isEmpty) {
    const lineNum = selections[0].active.line;
    const lineText = document.lineAt(lineNum).text;
    const olMatch = lineText.match(OL_PREFIX_RE);

    if (olMatch) {
      const cursorCol = selections[0].active.character;
      const prefixEnd = olMatch[0].length; // end of `indent + N. `

      if (cursorCol <= prefixEnd) {
        const indent = olMatch[1];
        const content = lineText.slice(prefixEnd);

        // Collect the ordered list before modifying the document
        const items = collectOrderedList(document, lineNum);
        const nodeIdx = items.findIndex((n) => n.line === lineNum);

        // Replace `N. content` with `<indent>- content`
        const pad = " ".repeat(getIndentSize());
        const newText = indent + pad + "- " + content;
        await hostEditor.replaceRange(document.lineAt(lineNum).range, newText);

        // Place cursor at start of content (after `<pad>- `)
        const contentStart = indent.length + pad.length + 2; // pad + "- "
        const newPos = new Position(lineNum, contentStart);
        hostEditor.setSelection(new Selection(newPos, newPos));

        // Renumber the outer list with this node removed
        if (nodeIdx >= 0) {
          const remaining = items.filter((_, i) => i !== nodeIdx);
          const startNum = nodeIdx === 0 ? 1 : remaining[Math.max(0, nodeIdx - 1)].num + 1;
          const renIdx = Math.min(nodeIdx, remaining.length);
          const edits = renumberEdits(hostEditor.getDocument()!, remaining, renIdx, startNum);
          await applyRenumberEdits(edits);
        }
        return;
      }
    }
  }

  const inserts: { position: Position; text: string }[] = [];
  const processed = new Set<number>();
  for (const sel of selections) {
    for (let i = sel.start.line; i <= sel.end.line; i++) {
      if (processed.has(i)) {
        continue;
      }
      processed.add(i);
      const line = document.lineAt(i);
      if (LIST_RE.test(line.text)) {
        inserts.push({ position: new Position(i, 0), text: " ".repeat(getIndentSize()) });
      }
    }
  }
  await hostEditor.batchInsertAt(inserts);
}

export async function outdentListItem(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    await hostEditor.executeCommand("outdent");
    return;
  }
  const document = hostEditor.getDocument()!;
  const selections = hostEditor.getSelections();

  const allOnList = selections.every((s) => {
    for (let i = s.start.line; i <= s.end.line; i++) {
      if (LIST_RE.test(document.lineAt(i).text)) {
        return true;
      }
    }
    return false;
  });

  if (!allOnList) {
    await hostEditor.executeCommand("outdent");
    return;
  }

  // Special case: single cursor on an unordered item (`  - text`) that is
  // nested inside an outer ordered list → convert to a numbered item and
  // insert it into the outer list, renumbering from the insertion point.
  if (selections.length === 1 && selections[0].isEmpty) {
    const lineNum = selections[0].active.line;
    const lineText = document.lineAt(lineNum).text;
    const ulMatch = lineText.match(UNORDERED_RE);

    const indentSize = getIndentSize();
    if (ulMatch && ulMatch[1].length >= indentSize) {
      const outerIndent = ulMatch[1].slice(indentSize); // remove one indent level
      const content = ulMatch[3];
      const OL_RE = Regex.orderedListItem;

      // Look for an ordered-list item above at the outer indent level
      let outerListLine = -1;
      for (let i = lineNum - 1; i >= 0; i--) {
        const t = document.lineAt(i).text;
        const m = t.match(OL_RE);
        if (m && m[1] === outerIndent) {
          outerListLine = i;
          break;
        }
        // Stop scanning if we hit a non-blank, non-indented line that isn't
        // a deeper list item or continuation content
        if (t.trim() !== "") {
          const li = t.match(Regex.lineIndent)?.[1].length ?? 0;
          if (li <= outerIndent.length && !t.match(OL_RE)) {
            break;
          }
        }
      }

      if (outerListLine >= 0) {
        // Collect the outer ordered list
        const items = collectOrderedList(document, outerListLine);
        if (items.length > 0) {
          const sep = items[0].sep;

          // Find which outer item this line sits under (the last item whose
          // line number is less than lineNum)
          let prevIdx = -1;
          for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].line < lineNum) {
              prevIdx = i;
              break;
            }
          }
          const insertNum = prevIdx >= 0 ? items[prevIdx].num + 1 : 1;

          // Replace `  - content` with `N. content` at the outer indent
          const newText = `${outerIndent}${insertNum}${sep}${content}`;
          await hostEditor.replaceRange(document.lineAt(lineNum).range, newText);

          // Place cursor at end of new marker prefix
          const prefixLen = outerIndent.length + String(insertNum).length + sep.length;
          const newPos = new Position(lineNum, prefixLen);
          hostEditor.setSelection(new Selection(newPos, newPos));

          // Re-collect the list (the document has changed) and renumber
          const updatedItems = collectOrderedList(hostEditor.getDocument()!, lineNum);
          const newNodeIdx = updatedItems.findIndex((n) => n.line === lineNum);
          if (newNodeIdx >= 0) {
            const edits = renumberEdits(hostEditor.getDocument()!, updatedItems, newNodeIdx, insertNum);
            await applyRenumberEdits(edits);
          }
          return;
        }
      }
    }
  }

  const deletes: Range[] = [];
  const processed = new Set<number>();
  for (const sel of selections) {
    for (let i = sel.start.line; i <= sel.end.line; i++) {
      if (processed.has(i)) {
        continue;
      }
      processed.add(i);
      const line = document.lineAt(i);
      const text = line.text;
      const sz = getIndentSize();
      if (text.startsWith(" ".repeat(sz)) && LIST_RE.test(text)) {
        deletes.push(new Range(new Position(i, 0), new Position(i, sz)));
      }
    }
  }
  await hostEditor.batchDeleteRanges(deletes);
}
