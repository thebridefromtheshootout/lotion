
import { Range } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

// ── Toggle list type ───────────────────────────────────────────────
//
// Cycles the current line(s) between:
//   - Unordered (- )
//   - Ordered (1. )
//   - Checkbox (- [ ] )
//   - Plain text (no marker)

const UL_RE = Regex.plainUnorderedList;
const OL_RE = Regex.orderedListPrefix;
const CHECK_RE = Regex.checkboxListAnyPrefix;
const ANY_LIST_RE = Regex.anyListPrefix;

export async function toggleListType(): Promise<void> {
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
      const text = line.text;

      if (CHECK_RE.test(text)) {
        edits.push({ range: line.range, text: text.replace(ANY_LIST_RE, "$1") });
      } else if (UL_RE.test(text)) {
        const match = text.match(Regex.unorderedListSimple);
        if (match) {
          const indent = match[1];
          const rest = text.slice(match[0].length);
          edits.push({ range: line.range, text: `${indent}1. ${rest}` });
        }
      } else if (OL_RE.test(text)) {
        const match = text.match(Regex.orderedListPrefix);
        if (match) {
          const indent = match[1];
          const rest = text.slice(match[0].length);
          edits.push({ range: line.range, text: `${indent}- [ ] ${rest}` });
        }
      } else {
        const match = text.match(Regex.lineIndent);
        const indent = match ? match[1] : "";
        const rest = text.slice(indent.length);
        edits.push({ range: line.range, text: `${indent}- ${rest}` });
      }
    }
  }
  await hostEditor.batchReplaceRanges(edits);
}
