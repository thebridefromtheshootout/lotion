import type { TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";

// ── Generic sibling collection ─────────────────────────────────────

/** A list item at a particular indent level, regardless of marker style. */
export interface AnyListNode {
  /** 0-based line number of the marker. */
  line: number;
  /** Full marker text including its trailing space (e.g. "- ", "1. ", "- [ ] "). */
  marker: string;
}

const ANY_MARKER_RE = Regex.anyListPrefix;

/**
 * Collect list items that appear below `startLine` and share the same
 * indent level (`indent`) as siblings of a list at that indent. Stops at:
 *   - A non-blank line at a smaller indent, OR
 *   - A non-blank, non-list line at the same indent.
 *
 * Skips blank lines, deeper-indent continuation content, and fenced code
 * blocks (``` / ~~~). Mixed marker styles are tolerated — any marker at
 * `indent` is treated as a sibling.
 */
export function collectListSiblingsBelow(
  doc: TextDocument,
  startLine: number,
  indent: string,
): AnyListNode[] {
  const items: AnyListNode[] = [];
  let inFenced = false;

  for (let i = startLine + 1; i < doc.lineCount; i++) {
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

    const m = text.match(ANY_MARKER_RE);
    if (m && m[1] === indent) {
      items.push({ line: i, marker: m[2] });
      continue;
    }

    const lineInd = text.match(Regex.lineIndent)?.[1].length ?? 0;
    if (lineInd > indent.length) {
      continue; // deeper continuation content
    }
    break;
  }

  return items;
}
