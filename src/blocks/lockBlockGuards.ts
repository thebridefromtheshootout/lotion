import { Disposable, Position, Selection } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { getBlockIndex } from "../core/blockIndex";
import { enrichDetailsBlock } from "./lockBlockDetails";

// ── Guard-suppression flag (mutable module state) ──────────────────
//
// Set during programmatic lock/unlock edits so the read-only guard
// doesn't fight our own writes. Lives at module scope because both the
// /lock handler (in lockBlock.ts) and lockAllBoxes() need to flip it.

let _guardSuppressed = false;

/** Run an async block with the read-only guard suppressed (try/finally safe). */
export async function withGuardSuppressed<T>(fn: () => PromiseLike<T> | T): Promise<T> {
  _guardSuppressed = true;
  try {
    return await fn();
  } finally {
    _guardSuppressed = false;
  }
}

// ── Encrypted-body range helpers ───────────────────────────────────

/**
 * All encrypted secretbox body ranges: [startLine, endLine] inclusive,
 * covering the body of each locked secretbox (between </summary> and </details>).
 */
function getEncryptedRanges(document: TextDocument): [number, number][] {
  const ranges: [number, number][] = [];
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) continue;
    if (block.summaryEndLine + 1 < block.endLine) {
      ranges.push([block.summaryEndLine + 1, block.endLine - 1]);
    }
  }
  return ranges;
}

/**
 * All encrypted secretbox displacement zones. Covers summaryEndLine+1
 * through endLine inclusive (i.e. including the </details> tag).
 */
function getEncryptedZones(
  document: TextDocument,
): { guardStart: number; guardEnd: number; summaryLine: number; afterLine: number }[] {
  const zones: { guardStart: number; guardEnd: number; summaryLine: number; afterLine: number }[] = [];
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) continue;
    if (block.summaryEndLine + 1 <= block.endLine) {
      zones.push({
        guardStart: block.summaryEndLine + 1,
        guardEnd: block.endLine,
        summaryLine: block.summaryEndLine,
        afterLine: Math.min(block.endLine + 1, document.lineCount - 1),
      });
    }
  }
  return zones;
}

// ── Read-only guard ────────────────────────────────────────────────

/**
 * Creates a disposable that prevents edits inside encrypted secretbox bodies.
 *
 * Two-layer defense:
 * 1. **Cursor displacement** — if the cursor enters an encrypted body range,
 *    it is direction-aware: moving down/right skips past the secretbox;
 *    moving up/left lands inside the summary text.
 * 2. **Edit-undo fallback** — any edit that still manages to touch a guarded
 *    range (e.g. programmatic edits, multi-cursor paste) is undone.
 */
export function createSecretboxGuard(): Disposable {
  let reverting = false;
  let displacingCursor = false;
  let lastWarningTime = 0;
  let prevLine = -1;
  let prevCol = -1;

  function warnOnce() {
    const now = Date.now();
    if (now - lastWarningTime > 2000) {
      lastWarningTime = now;
      hostEditor.showWarning("Lotion: Cannot edit encrypted secretbox content. Use /unlock first.");
    }
  }

  // ── Layer 1: direction-aware cursor displacement ─────────────────
  const selectionGuard = hostEditor.onDidChangeTextEditorSelection(() => {
    if (displacingCursor || _guardSuppressed) {
      return;
    }
    const doc = hostEditor.getDocument();
    if (!doc || doc.languageId !== "markdown") {
      return;
    }
    const zones = getEncryptedZones(doc);
    if (zones.length === 0) {
      // Track position even when no zones (cursor might enter one next time)
      const sel = hostEditor.getSelections()[0];
      if (sel) {
        prevLine = sel.active.line;
        prevCol = sel.active.character;
      }
      return;
    }

    const selections = hostEditor.getSelections();
    let needsDisplacement = false;
    const safeSelections = selections.map((sel) => {
      for (const zone of zones) {
        const activeInside =
          sel.active.line >= zone.guardStart && sel.active.line <= zone.guardEnd;
        const anchorInside =
          sel.anchor.line >= zone.guardStart && sel.anchor.line <= zone.guardEnd;
        if (!activeInside && !anchorInside) {
          continue;
        }
        needsDisplacement = true;

        // Determine direction: compare current active position with previous
        const curLine = sel.active.line;
        const curCol = sel.active.character;
        const movingDown =
          prevLine < 0 ||
          curLine > prevLine ||
          (curLine === prevLine && curCol > prevCol);

        // Compute the safe active position
        let safeActive: Position;
        if (movingDown) {
          safeActive = new Position(zone.afterLine, 0);
        } else {
          const summaryText = doc.lineAt(zone.summaryLine).text;
          const closingIdx = summaryText.indexOf("</summary>");
          const safeCol = closingIdx >= 0 ? closingIdx : summaryText.length;
          safeActive = new Position(zone.summaryLine, safeCol);
        }

        // Compute the safe anchor position (preserve anchor if it's outside)
        let safeAnchor: Position;
        if (anchorInside) {
          // Both ends inside — collapse to the safe active position
          safeAnchor = safeActive;
        } else {
          // Anchor is outside the zone — keep it to preserve the selection
          safeAnchor = sel.anchor;
        }

        return new Selection(safeAnchor, safeActive);
      }
      return sel;
    });

    if (needsDisplacement) {
      displacingCursor = true;
      hostEditor.setSelections(safeSelections);
      displacingCursor = false;
      // Update tracked position to the displaced position
      const displaced = safeSelections[0];
      if (displaced) {
        prevLine = displaced.active.line;
        prevCol = displaced.active.character;
      }
      warnOnce();
    } else {
      const sel = selections[0];
      if (sel) {
        prevLine = sel.active.line;
        prevCol = sel.active.character;
      }
    }
  });

  // ── Layer 2: edit-undo fallback ──────────────────────────────────
  const editGuard = hostEditor.onDidChangeTextDocument((e) => {
    if (reverting || _guardSuppressed) {
      return;
    }
    if (e.document.languageId !== "markdown") {
      return;
    }
    if (e.contentChanges.length === 0) {
      return;
    }

    const ranges = getEncryptedRanges(e.document);
    if (ranges.length === 0) {
      return;
    }

    for (const change of e.contentChanges) {
      const changeLine = change.range.start.line;
      const changeEndLine = change.range.end.line;

      for (const [guardStart, guardEnd] of ranges) {
        if (changeLine <= guardEnd && changeEndLine >= guardStart) {
          reverting = true;
          hostEditor.executeCommand("undo").then(() => {
            reverting = false;
            warnOnce();
          });
          return;
        }
      }
    }
  });

  return {
    dispose() {
      selectionGuard.dispose();
      editGuard.dispose();
    },
  };
}

