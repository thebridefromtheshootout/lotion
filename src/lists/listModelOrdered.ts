import { Position, Range, TextEdit } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

// ── Ordered list abstraction ───────────────────────────────────────
//
// Provides a model layer for ordered (numbered) markdown lists.
// A list is represented as a sequence of `ListNode` objects that can
// be manipulated (insert / remove) and then flushed back to the
// document via renumbering edits.

const OL_RE = Regex.orderedListItem;

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

      if (Regex.fencedCodeDelimiter.test(text)) {
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
      const lineIndent = text.match(Regex.lineIndent)?.[1].length ?? 0;
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

    if (Regex.fencedCodeDelimiter.test(text)) {
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
    const lineIndent = text.match(Regex.lineIndent)?.[1].length ?? 0;
    if (lineIndent <= listIndent.length) {
      break;
    }

    // Otherwise indented continuation content — skip
  }

  return items;
}

/**
 * Produce text edits that sequentially renumber `items[fromIndex..]`,
 * starting from `startNum`. Items before `fromIndex` are left alone.
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

/** Apply renumber edits to an editor (interactive editing context). */
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

/** Convert renumber edits to VS Code TextEdit objects (for on-save hooks). */
export function toTextEdits(edits: { line: number; col: number; oldLen: number; newText: string }[]): TextEdit[] {
  return edits.map((e) => {
    const start = new Position(e.line, e.col);
    const end = new Position(e.line, e.col + e.oldLen);
    return TextEdit.replace(new Range(start, end), e.newText);
  });
}
