
import { Position, Range, TextEdit } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const RENUMBER_SLASH_COMMAND: SlashCommand = {
  label: "/renumber",
  insertText: "",
  detail: "🔢 Renumber the entire ordered list",
  isAction: true,
  commandId: Cmd.renumberList,
  when: cursorInOrderedList,
  kind: 11,
  handler: handleRenumberList,
};

export const OL_TO_UL_SLASH_COMMAND: SlashCommand = {
  label: "/to-bullets",
  insertText: "",
  detail: "• Convert numbered list to bullet list",
  isAction: true,
  commandId: Cmd.olToUl,
  when: cursorInOrderedList,
  kind: 11,
  handler: handleOlToUl,
};

export const UL_TO_OL_SLASH_COMMAND: SlashCommand = {
  label: "/to-numbered",
  insertText: "",
  detail: "🔢 Convert bullet list to numbered list",
  isAction: true,
  commandId: Cmd.ulToOl,
  when: cursorInUnorderedList,
  kind: 11,
  handler: handleUlToOl,
};

// ── Ordered list abstraction ───────────────────────────────────────
//
// Provides a model layer for ordered (numbered) markdown lists.
// A list is represented as a sequence of `ListNode` objects that can
// be manipulated (insert / remove) and then flushed back to the
// document via renumbering edits.

const OL_RE = /^(\s*)(\d+)([.)]\s)/;

/** A single top-level ordered-list item (at a particular indent level). */
export interface ListNode {
  /** 0-based line number in the document where the marker lives. */
  line: number;
  /** Leading whitespace before the number. */
  indent: string;
  /** The current number on disk. */
  num: number;
  /** Separator style including trailing space, e.g. `. ` or `) `. */
  sep: string;
}

/**
 * Collect every ordered-list item that belongs to the same list as the
 * item on `startLine`.  Only items at the *same* indent level and with
 * the *same* separator style are included; deeper or different-style
 * items are skipped as continuation content.
 *
 * Handles:
 *   - Blank lines (continuation)
 *   - Indented continuation content (nested bullets, paragraphs, images…)
 *   - Fenced code blocks (``` / ~~~)
 *
 * Returns an empty array if `startLine` is not an ordered-list item.
 */
export function collectOrderedList(doc: TextDocument, startLine: number): ListNode[] {
  const firstMatch = doc.lineAt(startLine).text.match(OL_RE);
  if (!firstMatch) {
    return [];
  }

  const listIndent = firstMatch[1];
  const listSep = firstMatch[3];

  // Scan upward to find the true start of this list
  let topLine = startLine;
  {
    let inFenced = false;
    for (let i = startLine - 1; i >= 0; i--) {
      const text = doc.lineAt(i).text;

      if (/^\s*(```|~~~)/.test(text)) {
        inFenced = !inFenced;
        continue;
      }
      if (inFenced) {
        continue;
      }

      if (text.trim() === "") {
        continue;
      }

      const m = text.match(OL_RE);
      if (m && m[1] === listIndent && m[3] === listSep) {
        topLine = i;
        continue;
      }

      // Indented continuation content → keep scanning
      const lineIndent = text.match(/^(\s*)/)?.[1].length ?? 0;
      if (lineIndent > listIndent.length) {
        continue;
      }

      break; // not part of this list
    }
  }

  // Scan downward from `topLine` to collect all items
  const items: ListNode[] = [];
  let inFenced = false;

  for (let i = topLine; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;

    if (/^\s*(```|~~~)/.test(text)) {
      inFenced = !inFenced;
      continue;
    }
    if (inFenced) {
      continue;
    }

    if (text.trim() === "") {
      continue;
    }

    const m = text.match(OL_RE);
    if (m && m[1] === listIndent && m[3] === listSep) {
      items.push({
        line: i,
        indent: m[1],
        num: parseInt(m[2], 10),
        sep: m[3],
      });
      continue;
    }

    // Non-OL line at or before list indent → list ended
    const lineIndent = text.match(/^(\s*)/)?.[1].length ?? 0;
    if (lineIndent <= listIndent.length) {
      break;
    }

    // Otherwise indented continuation content — skip
  }

  return items;
}

/**
 * Produce text edits that sequentially renumber `items[fromIndex..]`,
 * starting from `startNum`.  Items before `fromIndex` are left alone.
 *
 * Returns the edits (does NOT apply them — the caller decides how).
 */
export function renumberEdits(
  doc: TextDocument,
  items: ListNode[],
  fromIndex: number,
  startNum: number,
): { line: number; col: number; oldLen: number; newText: string }[] {
  const edits: { line: number; col: number; oldLen: number; newText: string }[] = [];
  let num = startNum;

  for (let i = fromIndex; i < items.length; i++) {
    const node = items[i];
    if (node.num !== num) {
      edits.push({
        line: node.line,
        col: node.indent.length,
        oldLen: String(node.num).length,
        newText: String(num),
      });
    }
    num++;
  }

  return edits;
}

/**
 * Apply renumber edits to an editor (interactive editing context).
 */
export async function applyRenumberEdits(
  edits: { line: number; col: number; oldLen: number; newText: string }[],
): Promise<void> {
  if (edits.length === 0) {
    return;
  }
  await hostEditor.batchReplaceRanges(
    edits.map((e) => ({
      range: new Range(new Position(e.line, e.col), new Position(e.line, e.col + e.oldLen)),
      text: e.newText,
    })),
  );
}

/**
 * Convert renumber edits to VS Code TextEdit objects (for on-save hooks).
 */
export function toTextEdits(edits: { line: number; col: number; oldLen: number; newText: string }[]): TextEdit[] {
  return edits.map((e) => {
    const start = new Position(e.line, e.col);
    const end = new Position(e.line, e.col + e.oldLen);
    return TextEdit.replace(new Range(start, end), e.newText);
  });
}

// ── Predicates ─────────────────────────────────────────────────────

/**
 * Returns true when `position` is inside (or on) an ordered list.
 * Used as a `when` predicate for contextual slash commands.
 */
export function cursorInOrderedList(document: TextDocument, position: Position): boolean {
  return collectOrderedList(document, position.line).length > 0;
}

const UL_ITEM_RE = /^(\s*)([-*+]) /;

/**
 * Returns true when `position` is on an unordered list line (- / * / +).
 */
export function cursorInUnorderedList(document: TextDocument, position: Position): boolean {
  return UL_ITEM_RE.test(document.lineAt(position.line).text);
}

// ── Slash-command handler ──────────────────────────────────────────

/**
 * Renumber the entire ordered list around the cursor, starting from 1.
 */
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
    const li = text.match(/^(\s*)/)?.[1].length ?? 0;
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
    const li = text.match(/^(\s*)/)?.[1].length ?? 0;
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
