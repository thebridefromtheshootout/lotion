
import { Range } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

// ── Checkbox toggle ────────────────────────────────────────────────
//
// Toggles the checkbox on the current line between `- [ ]` and `- [x]`.
// If the line isn't a checkbox, converts a plain list item to a checkbox.


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

      if (Regex.checkboxCheckedLine.test(text)) {
        edits.push({ range: line.range, text: text.replace(Regex.checkboxCheckedLine, "$1[ ]") });
      } else if (Regex.checkboxUncheckedLine.test(text)) {
        edits.push({ range: line.range, text: text.replace(Regex.checkboxUncheckedLine, "$1[x]") });
      } else if (Regex.checkboxListPrefix.test(text)) {
        edits.push({ range: line.range, text: text.replace(Regex.checkboxListPrefix, "$1[ ] ") });
      }
    }
  }
  await hostEditor.batchReplaceRanges(edits);
}
