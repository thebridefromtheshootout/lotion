import type { TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";

// ── Pure list-marker helpers ───────────────────────────────────────
//
// Shared classification, parent-lookup, and next-marker derivation
// used by listContinue, listIndent, and listSwapMarker.  All functions
// here are stateless — they read from a TextDocument or a marker
// string and return data; they never mutate the editor.

const ANY_MARKER_RE = Regex.anyListPrefix;
const CHECKBOX_RE = /^[-*+] \[[ xX]\] $/;

export interface MarkerKind {
  ordered: boolean;
  bullet?: string;
  sep?: string;
  num?: number;
}

export function isCheckboxMarker(marker: string): boolean {
  return CHECKBOX_RE.test(marker);
}

export function classifyMarker(marker: string): MarkerKind {
  const m = marker.match(/^(\d+)([.)])\s$/);
  if (m) {
    return { ordered: true, sep: m[2], num: parseInt(m[1], 10) };
  }
  return { ordered: false, bullet: marker[0] };
}

export function sameStyle(a: MarkerKind, b: MarkerKind): boolean {
  if (a.ordered !== b.ordered) {
    return false;
  }
  return a.ordered ? a.sep === b.sep : a.bullet === b.bullet;
}

/**
 * The marker text to use on a new line that continues a list past
 * `parentMarker`.  Ordered → next number; checkbox → unchecked variant;
 * unordered → copy verbatim.
 */
export function continuationMarker(parentMarker: string): string {
  const ord = parentMarker.match(/^(\d+)([.)])\s$/);
  if (ord) {
    return `${parseInt(ord[1], 10) + 1}${ord[2]} `;
  }
  if (isCheckboxMarker(parentMarker)) {
    return `${parentMarker[0]} [ ] `;
  }
  return parentMarker;
}

/**
 * Walk upward from `lineNum - 1` to find a marker at exactly
 * `targetIndentLen` columns of indent.  Skips blanks and deeper-indent
 * continuation / sub-list content.  Returns null when a shallower-indent
 * line is hit (out of scope) or the document runs out.
 *
 * Used for indent / outdent / swap, where the target indent may sit
 * above an intervening sub-list.
 */
export function findMarkerAtIndent(
  doc: TextDocument,
  lineNum: number,
  targetIndentLen: number,
): MarkerKind | null {
  for (let i = lineNum - 1; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    if (text.trim() === "") {
      continue;
    }
    const lineIndentLen = text.match(Regex.lineIndent)?.[1].length ?? 0;
    if (lineIndentLen < targetIndentLen) {
      return null;
    }
    if (lineIndentLen > targetIndentLen) {
      continue;
    }
    const m = text.match(ANY_MARKER_RE);
    if (m && m[1].length === targetIndentLen) {
      return classifyMarker(m[2]);
    }
    // same indent, no marker → continuation, keep walking
  }
  return null;
}

/**
 * Walk upward through *strictly same-indent* marker-less lines until
 * we encounter a marker at the same indent (success) or any line at a
 * different indent / a blank line (failure).  Returns the parent's
 * marker text and indent, or null.
 *
 * Used for Enter on a continuation line that sits at the same indent
 * as its parent marker line.
 */
export function findSameIndentParentMarker(
  doc: TextDocument,
  lineNum: number,
): { indent: string; parentMarker: string } | null {
  const currentText = doc.lineAt(lineNum).text;
  if (currentText.trim() === "") {
    return null;
  }
  if (currentText.match(ANY_MARKER_RE)) {
    return null;
  }
  const currentIndent = currentText.match(Regex.lineIndent)?.[1] ?? "";

  for (let i = lineNum - 1; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    if (text.trim() === "") {
      return null;
    }
    const lineIndent = text.match(Regex.lineIndent)?.[1] ?? "";
    if (lineIndent !== currentIndent) {
      return null;
    }
    const m = text.match(ANY_MARKER_RE);
    if (m && m[1] === currentIndent) {
      return { indent: currentIndent, parentMarker: m[2] };
    }
  }
  return null;
}
