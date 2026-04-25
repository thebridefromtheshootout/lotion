
import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { collectOrderedList, renumberEdits, applyRenumberEdits } from "./listModel";
import type { ListNode } from "./listModel";
import { classifyMarker, findMarkerAtIndent, isCheckboxMarker } from "./listMarker";
import { Regex } from "../core/regex";

// ── Smart list indent / outdent ────────────────────────────────────
//
// Tab indents list items, Shift+Tab outdents.  For a single-cursor
// empty selection on a list line, the marker style is chosen from the
// most recent sibling at the destination indent (walking upward through
// continuation lines and skipping deeper-indent sub-list content).  Any
// outer ordered list left behind, and any ordered list joined, is
// renumbered.  Multi-line / multi-cursor / non-list cases fall through
// to whitespace-only adjustment.

const LIST_RE = Regex.listItem;
const ANY_MARKER_RE = Regex.anyListPrefix;

function getIndentSize(): number {
  const tabSize = hostEditor.getTabSize();
  return tabSize > 0 ? tabSize : 2;
}

/**
 * Smart single-cursor list-line shift.  Returns true when the smart
 * path handled the operation; false to fall back to whitespace-only.
 */
async function smartListLineShift(direction: "in" | "out"): Promise<boolean> {
  const document = hostEditor.getDocument();
  if (!document) {
    return false;
  }
  const selections = hostEditor.getSelections();
  if (selections.length !== 1 || !selections[0].isEmpty) {
    return false;
  }

  const lineNum = selections[0].active.line;
  const lineText = document.lineAt(lineNum).text;
  const m = lineText.match(ANY_MARKER_RE);
  if (!m) {
    return false;
  }

  const oldIndent = m[1];
  const oldMarker = m[2];
  const content = lineText.slice(oldIndent.length + oldMarker.length);
  const indentSize = getIndentSize();

  let newIndent: string;
  if (direction === "in") {
    newIndent = oldIndent + " ".repeat(indentSize);
  } else {
    if (oldIndent.length < indentSize) {
      return false;
    }
    newIndent = oldIndent.slice(0, oldIndent.length - indentSize);
  }

  const oldKind = classifyMarker(oldMarker);

  // Snapshot the outer ordered list (if any) before mutating, so we can
  // renumber it after our line leaves.
  let outerItems: ListNode[] = [];
  let outerNodeIdx = -1;
  if (oldKind.ordered) {
    outerItems = collectOrderedList(document, lineNum);
    outerNodeIdx = outerItems.findIndex((n) => n.line === lineNum);
  }

  // Pick the new marker.  Checkboxes preserve their own identity; for
  // everything else, adopt the parent's style at the new indent, or
  // fall back to a fresh `- ` list when no parent is found.
  const parent = findMarkerAtIndent(document, lineNum, newIndent.length);
  let newMarker: string;
  let adoptedOrderedParent = false;
  if (isCheckboxMarker(oldMarker)) {
    newMarker = oldMarker;
  } else if (parent) {
    if (parent.ordered) {
      newMarker = `${(parent.num ?? 0) + 1}${parent.sep} `;
      adoptedOrderedParent = true;
    } else {
      newMarker = `${parent.bullet} `;
    }
  } else {
    newMarker = "- ";
  }

  // Rewrite the line.
  const newLine = newIndent + newMarker + content;
  await hostEditor.replaceRange(document.lineAt(lineNum).range, newLine);

  // Cursor: preserve relative offset within content; if it was inside
  // the prefix area, place it at the end of the new prefix.
  const oldPrefixLen = oldIndent.length + oldMarker.length;
  const newPrefixLen = newIndent.length + newMarker.length;
  const cursorCol = selections[0].active.character;
  const newCursorCol =
    cursorCol < oldPrefixLen
      ? newPrefixLen
      : newPrefixLen + (cursorCol - oldPrefixLen);
  hostEditor.setSelection(
    new Selection(new Position(lineNum, newCursorCol), new Position(lineNum, newCursorCol)),
  );

  // Renumber the old outer ordered list (we left it).
  if (oldKind.ordered && outerNodeIdx >= 0) {
    if (direction === "in") {
      // Items above and below become one continuous list (our new
      // deeper-indent line acts as continuation between them).
      const remaining = outerItems.filter((_, i) => i !== outerNodeIdx);
      const startNum = outerNodeIdx === 0 ? 1 : outerItems[outerNodeIdx - 1].num + 1;
      const renIdx = outerNodeIdx;
      const edits = renumberEdits(hostEditor.getDocument()!, remaining, renIdx, startNum);
      await applyRenumberEdits(edits);
    } else {
      // Outdent splits the old list — items below restart at 1.
      const itemsBelow = outerItems.slice(outerNodeIdx + 1);
      const edits = renumberEdits(hostEditor.getDocument()!, itemsBelow, 0, 1);
      await applyRenumberEdits(edits);
    }
  }

  // Renumber the destination ordered list (we joined it).
  if (adoptedOrderedParent && parent) {
    const updatedDoc = hostEditor.getDocument()!;
    const updatedItems = collectOrderedList(updatedDoc, lineNum);
    const newNodeIdx = updatedItems.findIndex((n) => n.line === lineNum);
    if (newNodeIdx >= 0) {
      const startNum = (parent.num ?? 0) + 1;
      const edits = renumberEdits(updatedDoc, updatedItems, newNodeIdx, startNum);
      await applyRenumberEdits(edits);
    }
  }

  return true;
}

export async function indentListItem(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    await hostEditor.executeCommand("tab");
    return;
  }

  if (await smartListLineShift("in")) {
    return;
  }

  // Fallback: multi-line / multi-cursor / non-list — whitespace-only.
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
    await hostEditor.executeCommand("tab");
    return;
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

  if (await smartListLineShift("out")) {
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
