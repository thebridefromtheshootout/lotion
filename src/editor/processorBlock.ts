import type { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";

// ── Processor block markers ────────────────────────────────────────

export const PROC_START_RE = Regex.processorStart;
const PROC_DETAILS_OPEN = Regex.processorDetailsOpen;
const PROC_SUMMARY_OPEN = Regex.processorSummaryOpen;
const PROC_SUMMARY_CLOSE = Regex.processorSummaryClose;
const PROC_DETAILS_CLOSE = Regex.processorDetailsClose;

/**
 * Parsed processor block structure:
 *
 * <!-- lotion-processor: UUID -->
 * <details open>
 * <summary>command output (latest)</summary>
 *
 * input content (optional, the "body" / details area)
 *
 * </details>
 *
 * - The summary holds the latest command output.
 * - The details body holds any input sent to the command.
 * - The command itself lives only in processors.json, linked by the UUID.
 */
export function findProcessorBlock(
  document: TextDocument,
  procId: string,
): {
  markerLine: number;
  detailsStart: number;
  summaryStart: number;
  summaryEnd: number;
  bodyStart: number; // first line after summary (may == detailsEnd if no body)
  detailsEnd: number;
} | null {
  for (let i = 0; i < document.lineCount; i++) {
    const m = document.lineAt(i).text.match(PROC_START_RE);
    if (m && m[1] === procId) {
      const markerLine = i;
      let detailsStart = -1;
      let summaryStart = -1;
      let summaryEnd = -1;
      let detailsEnd = -1;

      for (let j = i + 1; j < Math.min(i + 200, document.lineCount); j++) {
        const lt = document.lineAt(j).text;

        if (detailsStart === -1 && PROC_DETAILS_OPEN.test(lt)) {
          detailsStart = j;
          continue;
        }

        if (detailsStart !== -1 && summaryStart === -1 && PROC_SUMMARY_OPEN.test(lt)) {
          summaryStart = j;
          // summary may span multiple lines; find </summary>
          if (PROC_SUMMARY_CLOSE.test(lt)) {
            summaryEnd = j;
          }
          continue;
        }

        if (summaryStart !== -1 && summaryEnd === -1) {
          if (PROC_SUMMARY_CLOSE.test(lt)) {
            summaryEnd = j;
          }
          continue;
        }

        if (summaryEnd !== -1 && PROC_DETAILS_CLOSE.test(lt)) {
          detailsEnd = j;
          break;
        }
      }

      if (detailsStart !== -1 && summaryStart !== -1 && summaryEnd !== -1 && detailsEnd !== -1) {
        const bodyStart = summaryEnd + 1;
        return { markerLine, detailsStart, summaryStart, summaryEnd, bodyStart, detailsEnd };
      }
      return null;
    }
  }
  return null;
}

// ── Block templating ───────────────────────────────────────────────

export function buildProcessorBlock(guid: string, output: string, inputBody?: string): string {
  const lines: string[] = [
    `<!-- lotion-processor: ${guid} -->`,
    `<details open>`,
    `<summary>${output}</summary>`,
    ``,
  ];
  if (inputBody !== undefined && inputBody.length > 0) {
    lines.push(inputBody, "");
  }
  lines.push("</details>", "");
  return lines.join("\n");
}

export function buildSummaryTag(output: string): string {
  return `<summary>${output}</summary>`;
}

// ── Predicate ──────────────────────────────────────────────────────

/**
 * True when the most recent processor marker above the cursor (`<!--lotion-processor:guid-->`)
 * is followed by a `<details>` block whose range contains the cursor line.
 *
 * Returns false if the closest marker is a non-processor lotion marker, or
 * if the marker has no enclosing details block, or if no marker is found
 * walking up to line 0.
 */
export function cursorInProcessor(document: TextDocument, position: Position): boolean {
  for (let i = position.line; i >= 0; i--) {
    const m = document.lineAt(i).text.match(PROC_START_RE);
    if (m) {
      const block = findProcessorBlock(document, m[1]);
      if (block && position.line >= block.markerLine && position.line <= block.detailsEnd) {
        return true;
      }
      return false;
    }
  }
  return false;
}
