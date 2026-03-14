// ── Regex registry ──────────────────────────────────────────────────
// Centralized regular expressions used across modules.

export const Regex = {
  httpUrl: /^https?:\/\/\S+$/,
  invalidPathChars: /[<>:"/\\|?*]/,
  markdownTableRow: /^\s*\|.*\|\s*$/,
  fencedCodeDelimiter: /^\s*(```|~~~)/,
  backtick: /`/g,
  listItem: /^(\s*)(?:[-*+]\s+|\d+[.)]\s+|-\s+\[[ xX]\]\s+)/,

  // Dates
  datePatterns: [
    /\b\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?\b/g, // YYYY-MM-DD [HH:mm]
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // MM/DD/YYYY or DD/MM/YYYY
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, // MMMM D, YYYY
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g, // D MMMM YYYY
    /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, // ddd, MMMM D, YYYY
  ],

  // Processor markers
  processorMarkerGlobal: /<!--\s*lotion-processor:\s*([0-9a-f-]+)\s*-->/g,
  processorStart: /^<!--\s*lotion-processor:\s*([0-9a-f-]+)\s*-->$/,
  processorDetailsOpen: /^<details[^>]*>\s*$/,
  processorSummaryOpen: /^<summary>/,
  processorSummaryClose: /<\/summary>\s*$/,
  processorDetailsClose: /^<\/details>\s*$/,
} as const;
