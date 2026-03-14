
import { Range } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

// ── Checkbox toggle ────────────────────────────────────────────────
//
// Toggles the checkbox on the current line between `- [ ]` and `- [x]`.
// If the line isn't a checkbox, converts a plain list item to a checkbox.

const CHECKED_RE = Regex.checkboxCheckedLine;
const UNCHECKED_RE = Regex.checkboxUncheckedLine;
const LIST_RE = Regex.checkboxListPrefix;

export async function toggleCheckbox(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const edits: { range: Range; text: string }[] = [];
  for (const selection of hostEditor.getSelections()) {
    const startLine = selection.start.line;
    const endLine = selection.end.line;

    for (let i = startLine; i <= endLine; i++) {
      const line = hostEditor.getLine(i);
      const text = line.text;

      if (CHECKED_RE.test(text)) {
        edits.push({ range: line.range, text: text.replace(CHECKED_RE, "$1[ ]") });
      } else if (UNCHECKED_RE.test(text)) {
        edits.push({ range: line.range, text: text.replace(UNCHECKED_RE, "$1[x]") });
      } else if (LIST_RE.test(text)) {
        edits.push({ range: line.range, text: text.replace(LIST_RE, "$1[ ] ") });
      }
    }
  }
  await hostEditor.batchReplaceRanges(edits);
}
