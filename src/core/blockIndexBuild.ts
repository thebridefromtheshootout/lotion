import type { TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "./regex";
import type {
  BlockIndex,
  CalloutKind,
  DetailsBlock,
  DetailsKind,
  MarkdownCallout,
  MarkdownTable,
  CodeFence,
} from "./blockIndexTypes";

// ── Single-pass build ──────────────────────────────────────────────

export function build(doc: TextDocument): BlockIndex {
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

// ── <details> block scanner ────────────────────────────────────────

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
