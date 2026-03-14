
import { Range } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

// ── Heading promotion / demotion ───────────────────────────────────
//
// Alt+Shift+Left  = promote (## → #)
// Alt+Shift+Right = demote  (## → ###)
// Works on multiple selected lines.

const HEADING_RE = Regex.headingPrefix;

export async function promoteHeading(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const edits: { range: Range; text: string }[] = [];
  const processed = new Set<number>();
  for (const sel of hostEditor.getSelections()) {
    for (let i = sel.start.line; i <= sel.end.line; i++) {
      if (processed.has(i)) {
        continue;
      }
      processed.add(i);

      const line = hostEditor.getLine(i);
      const match = line.text.match(HEADING_RE);
      if (match && match[1].length > 1) {
        // Remove one #
        edits.push({ range: line.range, text: line.text.replace(Regex.headingDropOneHash, "") });
      }
    }
  }
  await hostEditor.batchReplaceRanges(edits);
}

export async function demoteHeading(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const edits: { range: Range; text: string }[] = [];
  const processed = new Set<number>();
  for (const sel of hostEditor.getSelections()) {
    for (let i = sel.start.line; i <= sel.end.line; i++) {
      if (processed.has(i)) {
        continue;
      }
      processed.add(i);

      const line = hostEditor.getLine(i);
      const match = line.text.match(HEADING_RE);
      if (match && match[1].length < 6) {
        // Add one #
        edits.push({ range: line.range, text: "#" + line.text });
      }
    }
  }
  await hostEditor.batchReplaceRanges(edits);
}
