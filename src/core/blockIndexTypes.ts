// ── Block-index data shapes ────────────────────────────────────────
//
// Pure data types for the per-document block index. The build pass and
// the cache façade live in sibling files; this module is type-only so
// it's safe to import from anywhere without pulling in the cache.

export interface CodeFence {
  startLine: number;
  endLine: number;
  fenceChar: "`" | "~";
  lang?: string;
}

export type DetailsKind = "secretbox" | "graph" | "plain";

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
