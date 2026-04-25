import { Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { cursorInCodeContext } from "../editor/codeContext";
import { collectListSiblingsBelow } from "./listModel";

// ── List-marker swap on inline retype ──────────────────────────────
//
// When the cursor sits between an existing list marker and its content
// and the user types a fresh list marker (e.g. `1. ` or `* `), replace
// the existing marker with the typed one and re-marker any siblings
// below at the same indent level.
//
// Each follow-up edit (current line swap, sibling re-marker) is applied
// as its own editor.edit() call so it lands on a separate undo stop and
// can be undone independently of the user's original keystrokes.

const ANY_MARKER_SRC = "(?:[-*+] \\[[ x]\\] |[-*+] |\\d+[.)] )";
const NEW_MARKER_SRC = "(?:[-*+] |\\d+[.)] )";
const SWAP_RE = new RegExp(`^(\\s*)(${ANY_MARKER_SRC})(${NEW_MARKER_SRC})$`);

interface MarkerKind {
  ordered: boolean;
  bullet?: string;
  sep?: string;
  num?: number;
}

function classifyMarker(marker: string): MarkerKind {
  const m = marker.match(/^(\d+)([.)])\s$/);
  if (m) {
    return { ordered: true, sep: m[2], num: parseInt(m[1], 10) };
  }
  return { ordered: false, bullet: marker[0] };
}

function sameStyle(a: MarkerKind, b: MarkerKind): boolean {
  if (a.ordered !== b.ordered) {
    return false;
  }
  return a.ordered ? a.sep === b.sep : a.bullet === b.bullet;
}

export function createListSwapMarker(): Disposable {
  let processing = false;

  return hostEditor.onDidChangeTextDocument((e) => {
    if (processing) {
      return;
    }
    if (e.document.languageId !== "markdown") {
      return;
    }
    if (!hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
      return;
    }

    for (const change of e.contentChanges) {
      if (change.text !== " ") {
        continue;
      }
      // Pure single-character insertion only
      if (change.range.start.line !== change.range.end.line) {
        continue;
      }
      if (change.range.start.character !== change.range.end.character) {
        continue;
      }

      const doc = e.document;
      const lineNum = change.range.start.line;
      // After the typed space lands, the cursor sits one column past where it started.
      const cursorChar = change.range.start.character + 1;
      const lineText = doc.lineAt(lineNum).text;
      const before = lineText.substring(0, cursorChar);

      const m = before.match(SWAP_RE);
      if (!m) {
        continue;
      }

      const indent = m[1];
      const oldMarker = m[2];
      const newMarker = m[3];

      const oldKind = classifyMarker(oldMarker);
      const newKind = classifyMarker(newMarker);
      if (sameStyle(oldKind, newKind)) {
        continue;
      }

      if (cursorInCodeContext(doc, change.range.start)) {
        continue;
      }

      // Block ordered swaps starting at N>1 unless the preceding sibling at
      // the same indent (with no shallower-indent line in between) is N-1.
      if (newKind.ordered && (newKind.num ?? 1) > 1) {
        if (!hasPrecedingOrderedSibling(doc, lineNum, indent, newKind)) {
          continue;
        }
      }

      processing = true;
      void (async () => {
        try {
          await applySwap(lineNum, indent, oldMarker, newKind);
        } finally {
          processing = false;
        }
      })();

      return;
    }
  });
}

/**
 * True iff scanning upward from `lineNum` we find an ordered-list item at the
 * same indent whose number is `newKind.num - 1` and matching separator —
 * before encountering any non-blank line at a *shallower* indent (which would
 * mean we left the current list scope).
 */
function hasPrecedingOrderedSibling(
  doc: TextDocument,
  lineNum: number,
  indent: string,
  newKind: MarkerKind,
): boolean {
  if (!newKind.ordered || newKind.num === undefined) {
    return false;
  }
  const wanted = newKind.num - 1;
  let inFenced = false;

  // Walk top-down to keep fenced-block parity correct, collecting fence
  // toggles, then iterate the relevant slice in reverse.
  const fences: boolean[] = [];
  for (let i = 0; i < lineNum; i++) {
    if (Regex.fencedCodeDelimiter.test(doc.lineAt(i).text)) {
      inFenced = !inFenced;
    }
    fences.push(inFenced);
  }

  for (let i = lineNum - 1; i >= 0; i--) {
    if (fences[i]) {
      continue;
    }
    const text = doc.lineAt(i).text;
    if (Regex.fencedCodeDelimiter.test(text)) {
      continue;
    }
    if (text.trim() === "") {
      continue;
    }

    const lineInd = text.match(Regex.lineIndent)?.[1].length ?? 0;
    if (lineInd < indent.length) {
      return false; // left the current list scope
    }
    if (lineInd > indent.length) {
      continue; // deeper continuation, skip
    }

    const m = text.match(/^(\s*)(\d+)([.)])\s/);
    if (!m || m[1] !== indent) {
      return false; // same-indent non-ordered or wrong-indent line ends scope
    }
    if (m[3] !== newKind.sep) {
      return false; // different separator → different list
    }
    return parseInt(m[2], 10) === wanted;
  }
  return false;
}

async function applySwap(
  lineNum: number,
  indent: string,
  oldMarker: string,
  newKind: MarkerKind,
): Promise<void> {
  // Edit 1 — strip the old marker so the user's typed marker becomes the
  // line's actual list marker.  Own undo stops so the user can revert just
  // this conversion.
  const oldStart = indent.length;
  const oldEnd = indent.length + oldMarker.length;
  await hostEditor.replaceRange(
    new Range(new Position(lineNum, oldStart), new Position(lineNum, oldEnd)),
    "",
    { undoStopBefore: true, undoStopAfter: true },
  );

  // Edit 2 — re-marker siblings at the same indent.  Separate editor.edit()
  // call → separate undo stop, independently revertable.
  const doc = hostEditor.getDocument();
  if (!doc) {
    return;
  }

  const siblings = collectListSiblingsBelow(doc, lineNum, indent);
  if (siblings.length === 0) {
    return;
  }

  const edits: { range: Range; text: string }[] = [];
  let counter = newKind.ordered ? (newKind.num ?? 1) + 1 : 0;

  for (const sib of siblings) {
    let next: string;
    if (newKind.ordered) {
      next = `${counter}${newKind.sep} `;
      counter++;
    } else {
      next = `${newKind.bullet} `;
    }
    if (sib.marker === next) {
      continue;
    }
    edits.push({
      range: new Range(
        new Position(sib.line, indent.length),
        new Position(sib.line, indent.length + sib.marker.length),
      ),
      text: next,
    });
  }

  if (edits.length === 0) {
    return;
  }
  await hostEditor.batchReplaceRanges(edits);
}
