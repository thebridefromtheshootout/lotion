import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

import {
  applyRenumberEdits,
  collectOrderedList,
  renumberEdits,
} from "./listModelOrdered";

// ── Re-exports for the public API ──────────────────────────────────

export type { ListNode } from "./listModelOrdered";
export {
  collectOrderedList,
  renumberEdits,
  applyRenumberEdits,
  toTextEdits,
} from "./listModelOrdered";
export type { AnyListNode } from "./listModelSiblings";
export { collectListSiblingsBelow } from "./listModelSiblings";

// ── Slash command exports ──────────────────────────────────────────

export const RENUMBER_SLASH_COMMAND: SlashCommand = {
  label: "/renumber",
  insertText: "",
  detail: "🔢 Renumber the entire ordered list",
  isAction: true,
  commandId: Cmd.renumberList,
  cmdFilter: Filter().cursorInOrderedList(),
  kind: 11,
  handler: handleRenumberList,
};

export const OL_TO_UL_SLASH_COMMAND: SlashCommand = {
  label: "/to-bullets",
  insertText: "",
  detail: "• Convert numbered list to bullet list",
  isAction: true,
  commandId: Cmd.olToUl,
  cmdFilter: Filter().cursorInOrderedList(),
  kind: 11,
  handler: handleOlToUl,
};

export const UL_TO_OL_SLASH_COMMAND: SlashCommand = {
  label: "/to-numbered",
  insertText: "",
  detail: "🔢 Convert bullet list to numbered list",
  isAction: true,
  commandId: Cmd.ulToOl,
  cmdFilter: Filter().cursorInUnorderedList(),
  kind: 11,
  handler: handleUlToOl,
};

// ── Predicates ─────────────────────────────────────────────────────

const UL_ITEM_RE = Regex.unorderedListSimple;

/**
 * Returns true when `position` is inside (or on) an ordered list.
 * Used as a `when` predicate for contextual slash commands.
 */
export function cursorInOrderedList(document: TextDocument, position: Position): boolean {
  return collectOrderedList(document, position.line).length > 0;
}

/** Returns true when `position` is on an unordered list line (- / * / +). */
export function cursorInUnorderedList(document: TextDocument, position: Position): boolean {
  return UL_ITEM_RE.test(document.lineAt(position.line).text);
}

// ── /renumber handler ──────────────────────────────────────────────

/** Renumber the entire ordered list around the cursor, starting from 1. */
export async function handleRenumberList(doc: TextDocument, _pos: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(doc)) {
    return;
  }

  const items = collectOrderedList(doc, hostEditor.getCursorPosition()!.line);
  if (items.length === 0) {
    return;
  }

  const edits = renumberEdits(doc, items, 0, 1);
  if (edits.length === 0) {
    hostEditor.showInformation("List is already correctly numbered.");
    return;
  }

  await applyRenumberEdits(edits);
}

// ── OL ↔ UL conversion handlers ───────────────────────────────────

/**
 * Convert the ordered list under the cursor to an unordered list.
 * Preserves indentation; replaces each `N. ` / `N) ` with `- `.
 */
export async function handleOlToUl(doc: TextDocument, _pos: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(doc)) {
    return;
  }

  const items = collectOrderedList(doc, hostEditor.getCursorPosition()!.line);
  if (items.length === 0) {
    return;
  }

  await hostEditor.batchReplaceRanges(
    items.map((node) => {
      const marker = String(node.num) + node.sep;
      const markerStart = node.indent.length;
      const markerEnd = markerStart + marker.length;
      return {
        range: new Range(new Position(node.line, markerStart), new Position(node.line, markerEnd)),
        text: "- ",
      };
    }),
  );
}

/**
 * Convert the unordered list under the cursor to an ordered list.
 * Preserves indentation; replaces each `- ` / `* ` / `+ ` with `N. `.
 * Only converts items at the same indent level as the cursor line.
 */
export async function handleUlToOl(doc: TextDocument, _pos: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(doc)) {
    return;
  }

  const cursorLine = hostEditor.getCursorPosition()!.line;
  const cursorMatch = doc.lineAt(cursorLine).text.match(UL_ITEM_RE);
  if (!cursorMatch) {
    return;
  }

  const targetIndent = cursorMatch[1];

  // Collect contiguous UL items at the same indent level
  // Scan up
  let topLine = cursorLine;
  for (let i = cursorLine - 1; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    if (text.trim() === "") {
      continue;
    }
    const m = text.match(UL_ITEM_RE);
    if (m && m[1] === targetIndent) {
      topLine = i;
      continue;
    }
    // indented continuation content → keep scanning
    const li = text.match(Regex.lineIndent)?.[1].length ?? 0;
    if (li > targetIndent.length) {
      continue;
    }
    break;
  }

  // Scan down and collect
  const lines: { line: number; markerStart: number; markerEnd: number }[] = [];
  for (let i = topLine; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;
    if (text.trim() === "") {
      continue;
    }
    const m = text.match(UL_ITEM_RE);
    if (m && m[1] === targetIndent) {
      const ms = m[1].length;
      lines.push({ line: i, markerStart: ms, markerEnd: ms + m[2].length + 1 }); // "- " = marker + space
      continue;
    }
    const li = text.match(Regex.lineIndent)?.[1].length ?? 0;
    if (li > targetIndent.length) {
      continue;
    }
    break;
  }

  if (lines.length === 0) {
    return;
  }

  await hostEditor.batchReplaceRanges(
    lines.map((item) => {
      const num = lines.indexOf(item) + 1;
      return {
        range: new Range(new Position(item.line, item.markerStart), new Position(item.line, item.markerEnd)),
        text: `${num}. `,
      };
    }),
  );
}
