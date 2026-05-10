import type { Position, TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";

// ── Graphviz diagram block ─────────────────────────────────────────
//
// Structure in markdown:
//
//   <details open>
//   <summary>
//
//   ![graph](.rsrc/graph-<hash>.svg)
//
//   </summary>
//
//   ```dot
//   digraph G { ... }
//   ```
//
//   </details>

export interface GraphBlock {
  detailsStart: number;
  detailsEnd: number;
  /** First line of summary content (between <summary> and </summary>) */
  summaryContentStart: number;
  /** Last line of summary content (exclusive of </summary> line) */
  summaryContentEnd: number;
  /** The DOT source code */
  dotSource: string;
  /** The existing image path from ![graph](...), if any */
  imagePath?: string;
}

export function findGraphBlock(document: TextDocument, cursorLine: number): GraphBlock | null {
  const lineCount = document.lineCount;

  // Search upward for <details
  let detailsStart = -1;
  for (let i = cursorLine; i >= 0; i--) {
    if (/^\s*<details/i.test(document.lineAt(i).text)) {
      detailsStart = i;
      break;
    }
  }
  if (detailsStart === -1) {
    return null;
  }

  // Search downward for </details>
  let detailsEnd = -1;
  for (let i = Math.max(cursorLine, detailsStart + 1); i < lineCount; i++) {
    if (/^\s*<\/details>/i.test(document.lineAt(i).text)) {
      detailsEnd = i;
      break;
    }
  }
  if (detailsEnd === -1) {
    return null;
  }

  // Verify cursor is inside
  if (cursorLine < detailsStart || cursorLine > detailsEnd) {
    return null;
  }

  // Find <summary> and </summary>
  let summaryStart = -1;
  let summaryEnd = -1;
  for (let i = detailsStart; i <= detailsEnd; i++) {
    const text = document.lineAt(i).text;
    if (summaryStart === -1 && Regex.summaryTagOpen.test(text)) {
      summaryStart = i;
    }
    if (summaryStart !== -1 && Regex.summaryTagClose.test(text)) {
      summaryEnd = i;
      break;
    }
  }
  if (summaryStart === -1 || summaryEnd === -1) {
    return null;
  }

  // Find ```dot ... ``` inside the block
  let dotStart = -1;
  let dotEnd = -1;
  for (let i = summaryEnd + 1; i < detailsEnd; i++) {
    const text = document.lineAt(i).text;
    if (dotStart === -1 && Regex.dotFenceOpenLine.test(text)) {
      dotStart = i;
      continue;
    }
    if (dotStart !== -1 && Regex.anyFenceCloseLine.test(text)) {
      dotEnd = i;
      break;
    }
  }
  if (dotStart === -1 || dotEnd === -1) {
    return null;
  }

  // Extract DOT source
  const dotLines: string[] = [];
  for (let i = dotStart + 1; i < dotEnd; i++) {
    dotLines.push(document.lineAt(i).text);
  }

  // Summary content is between the <summary> line and </summary> line
  const summaryContentStart = summaryStart + 1;
  const summaryContentEnd = summaryEnd - 1;

  // Try to extract existing image path from summary
  let imagePath: string | undefined;
  for (let i = summaryContentStart; i <= summaryContentEnd; i++) {
    const m = document.lineAt(i).text.match(Regex.markdownImageSimple);
    if (m) {
      imagePath = m[1];
      break;
    }
  }

  return {
    detailsStart,
    detailsEnd,
    summaryContentStart,
    summaryContentEnd,
    dotSource: dotLines.join("\n"),
    imagePath,
  };
}

// ── Predicate ──────────────────────────────────────────────────────

export function cursorInGraph(document: TextDocument, position: Position): boolean {
  return findGraphBlock(document, position.line) !== null;
}

// ── Block templating ───────────────────────────────────────────────

export function buildBlock(imagePath: string, dot: string): string {
  return [
    "<details open>",
    "<summary>",
    "",
    `![graph](${imagePath})`,
    "",
    "</summary>",
    "",
    "```dot",
    dot,
    "```",
    "",
    "</details>",
    "",
  ].join("\n");
}
