import { Regex } from "../core/regex";
import { parseCsvLine } from "../core/csv";

// ── Table data detection (TSV / CSV) ───────────────────────────────

/**
 * Try to interpret clipboard text as tab-separated or CSV data.
 * Returns a markdown table string, or undefined if not tabular.
 */
export function tryParseTableData(text: string): string | undefined {
  const lines = text.split(Regex.lineBreakSplit).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return undefined;
  }

  // Check for tab-separated
  const tabCounts = lines.map((l) => (l.match(Regex.tabGlobal) || []).length);
  const allSameTabCount = tabCounts.every((c) => c === tabCounts[0] && c >= 1);

  if (allSameTabCount) {
    return toMarkdownTable(lines.map((l) => l.split("\t").map((c) => c.trim())));
  }

  // Check for CSV (at least 2 commas per line, consistent count)
  const commaCounts = lines.map((l) => (l.match(Regex.commaGlobal) || []).length);
  const allSameCommaCount = commaCounts.every((c) => c === commaCounts[0] && c >= 1);

  if (allSameCommaCount) {
    return toMarkdownTable(lines.map((l) => parseCsvLine(l)));
  }

  return undefined;
}

function toMarkdownTable(rows: string[][]): string {
  if (rows.length < 1) {
    return "";
  }

  const cols = Math.max(...rows.map((r) => r.length));
  const normalised = rows.map((r) => {
    while (r.length < cols) {
      r.push("");
    }
    return r;
  });

  const widths = Array.from({ length: cols }, (_, i) => Math.max(3, ...normalised.map((r) => r[i].length)));

  const pad = (s: string, w: number) => s.padEnd(w);
  const header = "| " + normalised[0].map((c, i) => pad(c, widths[i])).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const body = normalised.slice(1).map((row) => "| " + row.map((c, i) => pad(c, widths[i])).join(" | ") + " |");

  return [header, sep, ...body].join("\n");
}
