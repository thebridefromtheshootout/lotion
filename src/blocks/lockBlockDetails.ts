import type { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";
import { getBlockIndex } from "../core/blockIndex";
import type { DetailsBlock as IndexedDetailsBlock } from "../core/blockIndex";

const LOCK_MARKER_RE = Regex.lockMarker;

// ── Enriched <details> block view ──────────────────────────────────

export interface DetailsBlock {
  /** Line number of <details> */
  startLine: number;
  /** Line number of </details> */
  endLine: number;
  /** Line number of the closing </summary> tag (or the line containing it) */
  summaryEndLine: number;
  /** The summary text (plain, without 🔒) */
  summaryText: string;
  /** Lines between end-of-summary and </details> (the "body") */
  bodyLines: string[];
  /** Whether the block is currently encrypted */
  isEncrypted: boolean;
  /** If encrypted, the blob string */
  encryptedBlob?: string;
  /** Whether this is a lotion secretbox */
  isSecretbox: boolean;
}

export function findDetailsBlock(document: TextDocument, cursorLine: number): DetailsBlock | undefined {
  const indexed = getBlockIndex(document).detailsBlockAt(cursorLine);
  if (!indexed) return undefined;
  return enrichDetailsBlock(document, indexed);
}

/**
 * Enrich an indexed DetailsBlock with the runtime data lockBlock handlers need:
 * collected body lines, lock-marker detection, and isSecretbox flag.
 */
export function enrichDetailsBlock(document: TextDocument, indexed: IndexedDetailsBlock): DetailsBlock {
  const bodyLines: string[] = [];
  for (let i = indexed.bodyStartLine; i <= indexed.bodyEndLine; i++) {
    bodyLines.push(document.lineAt(i).text);
  }

  let isEncrypted = false;
  let encryptedBlob: string | undefined;
  for (const line of bodyLines) {
    const m = line.trim().match(LOCK_MARKER_RE);
    if (m) {
      isEncrypted = true;
      encryptedBlob = m[1];
      break;
    }
  }

  return {
    startLine: indexed.startLine,
    endLine: indexed.endLine,
    summaryEndLine: indexed.summaryEndLine,
    summaryText: indexed.summaryText,
    bodyLines,
    isEncrypted,
    encryptedBlob,
    isSecretbox: indexed.kind === "secretbox",
  };
}

// ── Predicate ──────────────────────────────────────────────────────

/** True when the cursor is inside a lotion secretbox (<!--lotion-secretbox-->). */
export function cursorInSecretbox(document: TextDocument, position: Position): boolean {
  const block = findDetailsBlock(document, position.line);
  return block !== undefined && block.isSecretbox;
}
