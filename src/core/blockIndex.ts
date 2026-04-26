// Per-document index of structural blocks (code fences, <details>, callouts, tables).
// Built in a single linear pass; consumers query via O(log N) binary search.
//
// Read path is synchronous: getBlockIndex(doc) always returns a real index. On a
// cache miss it builds now. Background path keeps the cache warm: on text change
// a 50ms throttled rebuild is scheduled (initBlockIndex wires this in extension.ts).

import type { Disposable, TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "./regex";

export interface CodeFence {
  startLine: number;
  endLine: number;
  fenceChar: "`" | "~";
  lang?: string;
}

export type DetailsKind = "secretbox" | "graph" | "carousel" | "plain";

export interface DetailsBlock {
  startLine: number;
  endLine: number;
  summaryStartLine: number;
  summaryEndLine: number;
  summaryText: string;
  bodyStartLine: number;
  bodyEndLine: number;
  kind: DetailsKind;
}

export type CalloutKind = "NOTE" | "TIP" | "WARNING" | "IMPORTANT" | "CAUTION";

export interface MarkdownCallout {
  startLine: number;
  endLine: number;
  kind: CalloutKind;
}

export interface MarkdownTable {
  startLine: number;
  endLine: number;
  headerLine: number;
  separatorLine: number;
  dataStartLine: number;
}

export interface BlockIndex {
  version: number;
  codeFences: CodeFence[];
  detailsBlocks: DetailsBlock[];
  callouts: MarkdownCallout[];
  tables: MarkdownTable[];
  isInCodeFence(line: number): boolean;
  detailsBlockAt(line: number): DetailsBlock | undefined;
  calloutAt(line: number): MarkdownCallout | undefined;
  tableAt(line: number): MarkdownTable | undefined;
}

interface CacheEntry {
  index: BlockIndex;
}

const cache = new WeakMap<TextDocument, CacheEntry>();
const pendingTimers = new WeakMap<TextDocument, ReturnType<typeof setTimeout>>();
const REBUILD_DELAY_MS = 50;

export function getBlockIndex(doc: TextDocument): BlockIndex {
  const cached = cache.get(doc);
  if (cached && cached.index.version === doc.version) {
    return cached.index;
  }
  const index = build(doc);
  cache.set(doc, { index });
  return index;
}

function scheduleRebuild(doc: TextDocument): void {
  const existing = pendingTimers.get(doc);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    pendingTimers.delete(doc);
    const cached = cache.get(doc);
    if (cached && cached.index.version === doc.version) {
      return; // a synchronous read already filled the cache
    }
    cache.set(doc, { index: build(doc) });
  }, REBUILD_DELAY_MS);
  pendingTimers.set(doc, timer);
}

export function initBlockIndex(): Disposable {
  return hostEditor.onDidChangeTextDocument((e) => {
    if (e.document.languageId !== "markdown") return;
    scheduleRebuild(e.document);
  });
}

// ── Build ──────────────────────────────────────────────────────────

function build(doc: TextDocument): BlockIndex {
  const codeFences: CodeFence[] = [];
  const detailsBlocks: DetailsBlock[] = [];
  const callouts: MarkdownCallout[] = [];
  const tables: MarkdownTable[] = [];

  const lineCount = doc.lineCount;
  const lines: string[] = new Array(lineCount);
  for (let i = 0; i < lineCount; i++) {
    lines[i] = doc.lineAt(i).text;
  }

  // ── Pass 1: code fences (these mask everything else) ─────────────
  let fenceOpen: { startLine: number; fenceChar: "`" | "~"; lang?: string } | undefined;
  for (let i = 0; i < lineCount; i++) {
    const text = lines[i];
    const match = text.match(Regex.fencedCodeDelimiter);
    if (!match) continue;
    if (!fenceOpen) {
      const fenceChar = match[1].charAt(0) as "`" | "~";
      const lang = text.trim().slice(3).trim() || undefined;
      fenceOpen = { startLine: i, fenceChar, lang };
    } else if (text.trim().startsWith(fenceOpen.fenceChar.repeat(3))) {
      codeFences.push({
        startLine: fenceOpen.startLine,
        endLine: i,
        fenceChar: fenceOpen.fenceChar,
        lang: fenceOpen.lang,
      });
      fenceOpen = undefined;
    }
  }
  // Unclosed fence: treat the rest of the document as fenced.
  if (fenceOpen) {
    codeFences.push({
      startLine: fenceOpen.startLine,
      endLine: lineCount - 1,
      fenceChar: fenceOpen.fenceChar,
      lang: fenceOpen.lang,
    });
  }

  const isFenceLine = (line: number): boolean => {
    for (const f of codeFences) {
      if (line >= f.startLine && line <= f.endLine) return true;
      if (line < f.startLine) return false;
    }
    return false;
  };

  // ── Pass 2: details / callouts / tables, skipping fenced regions ──
  let i = 0;
  while (i < lineCount) {
    if (isFenceLine(i)) {
      i++;
      continue;
    }
    const text = lines[i];

    // <details>
    if (Regex.detailsOpenLine.test(text)) {
      const block = scanDetails(lines, i, lineCount);
      if (block) {
        detailsBlocks.push(block);
        i = block.endLine + 1;
        continue;
      }
    }

    // Callout open
    const calloutMatch = text.match(Regex.calloutOpen);
    if (calloutMatch) {
      const startLine = i;
      const kind = calloutMatch[1].toUpperCase() as CalloutKind;
      let end = i;
      for (let j = i + 1; j < lineCount; j++) {
        if (Regex.calloutContinuation.test(lines[j])) {
          end = j;
        } else {
          break;
        }
      }
      callouts.push({ startLine, endLine: end, kind });
      i = end + 1;
      continue;
    }

    // Table: header row + separator row directly below
    if (Regex.markdownTableRow.test(text) && i + 1 < lineCount && Regex.markdownTableSeparatorRow.test(lines[i + 1])) {
      const headerLine = i;
      const separatorLine = i + 1;
      let end = separatorLine;
      for (let j = separatorLine + 1; j < lineCount; j++) {
        if (Regex.markdownTableRow.test(lines[j])) {
          end = j;
        } else {
          break;
        }
      }
      tables.push({
        startLine: headerLine,
        endLine: end,
        headerLine,
        separatorLine,
        dataStartLine: separatorLine + 1,
      });
      i = end + 1;
      continue;
    }

    i++;
  }

  return {
    version: doc.version,
    codeFences,
    detailsBlocks,
    callouts,
    tables,
    isInCodeFence(line: number): boolean {
      return rangeContains(codeFences, line);
    },
    detailsBlockAt(line: number): DetailsBlock | undefined {
      return rangeFind(detailsBlocks, line);
    },
    calloutAt(line: number): MarkdownCallout | undefined {
      return rangeFind(callouts, line);
    },
    tableAt(line: number): MarkdownTable | undefined {
      return rangeFind(tables, line);
    },
  };
}

function scanDetails(lines: string[], startLine: number, lineCount: number): DetailsBlock | undefined {
  // Find matching </details>, accounting for nested <details>.
  let depth = 1;
  let endLine = -1;
  for (let j = startLine + 1; j < lineCount; j++) {
    const t = lines[j];
    if (Regex.detailsOpenLine.test(t)) {
      depth++;
    } else if (Regex.detailsCloseLine.test(t)) {
      depth--;
      if (depth === 0) {
        endLine = j;
        break;
      }
    }
  }
  if (endLine === -1) return undefined;

  // Locate <summary>...</summary> within [startLine, endLine].
  let summaryStartLine = -1;
  let summaryEndLine = -1;
  let summaryText = "";
  for (let j = startLine; j <= endLine; j++) {
    const line = lines[j];
    if (summaryStartLine === -1 && Regex.summaryTagOpen.test(line)) {
      summaryStartLine = j;
      const inline = line.match(Regex.summaryTagInline);
      if (inline) {
        summaryEndLine = j;
        summaryText = inline[1].replace(Regex.lockIconPrefix, "").trim();
        break;
      }
      const startCap = line.match(Regex.summaryTagStartCapture);
      if (startCap) {
        summaryText = startCap[1].replace(Regex.lockIconPrefix, "").trim();
      }
      continue;
    }
    if (summaryStartLine !== -1 && Regex.summaryTagClose.test(line)) {
      summaryEndLine = j;
      break;
    }
  }
  if (summaryStartLine === -1) {
    summaryStartLine = startLine;
    summaryEndLine = startLine;
  }
  if (summaryEndLine === -1) {
    summaryEndLine = summaryStartLine;
  }

  const bodyStartLine = summaryEndLine + 1;
  const bodyEndLine = endLine - 1;

  // Classify
  let kind: DetailsKind = "plain";
  if (Regex.secretboxTagLine.test(lines[startLine])) {
    kind = "secretbox";
  } else {
    for (let j = bodyStartLine; j <= bodyEndLine && j < lineCount; j++) {
      const t = lines[j];
      if (Regex.dotFenceOpenLine.test(t)) {
        kind = "graph";
        break;
      }
      if (/lotion-carousel/i.test(t)) {
        kind = "carousel";
        break;
      }
    }
  }

  return {
    startLine,
    endLine,
    summaryStartLine,
    summaryEndLine,
    summaryText,
    bodyStartLine,
    bodyEndLine,
    kind,
  };
}

// ── Range helpers (binary search) ──────────────────────────────────

function rangeContains(ranges: { startLine: number; endLine: number }[], line: number): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (line < r.startLine) {
      hi = mid - 1;
    } else if (line > r.endLine) {
      lo = mid + 1;
    } else {
      return true;
    }
  }
  return false;
}

function rangeFind<T extends { startLine: number; endLine: number }>(ranges: T[], line: number): T | undefined {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (line < r.startLine) {
      hi = mid - 1;
    } else if (line > r.endLine) {
      lo = mid + 1;
    } else {
      return r;
    }
  }
  return undefined;
}
