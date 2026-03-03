
import { Selection } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

/**
 * "Wrap With …" command – wrap selected text (or word at cursor) with
 * user‑chosen delimiters. Presents a quick pick of common wrappers plus
 * a custom option.
 */

interface Wrapper {
  label: string;
  left: string;
  right: string;
}

const WRAPPERS: Wrapper[] = [
  { label: "( ) Parentheses", left: "(", right: ")" },
  { label: "[ ] Square brackets", left: "[", right: "]" },
  { label: "{ } Curly braces", left: "{", right: "}" },
  { label: "< > Angle brackets", left: "<", right: ">" },
  { label: '" " Double quotes', left: '"', right: '"' },
  { label: "' ' Single quotes", left: "'", right: "'" },
  { label: "` ` Backticks", left: "`", right: "`" },
  { label: "** ** Bold", left: "**", right: "**" },
  { label: "* * Italic", left: "*", right: "*" },
  { label: "~~ ~~ Strikethrough", left: "~~", right: "~~" },
  { label: "== == Highlight", left: "==", right: "==" },
  { label: "$$ Math (display)", left: "$$\n", right: "\n$$" },
  { label: "$ $ Math (inline)", left: "$", right: "$" },
  { label: "``` Code block", left: "```\n", right: "\n```" },
  { label: "Custom…", left: "", right: "" },
];

export async function wrapWith(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const doc = hostEditor.getDocument()!;

  // If nothing selected, expand selection to word
  let selection = hostEditor.getSelection()!;
  if (selection.isEmpty) {
    const wordRange = doc.getWordRangeAtPosition(selection.active);
    if (wordRange) {
      selection = new Selection(wordRange.start, wordRange.end);
    } else {
      return; // nothing to wrap
    }
  }

  const picked = await hostEditor.showQuickPick(
    WRAPPERS.map((w) => ({ label: w.label, wrapper: w })),
    { placeHolder: "Wrap selection with…" },
  );

  if (!picked) {
    return;
  }

  let left = picked.wrapper.left;
  let right = picked.wrapper.right;

  if (picked.wrapper.label === "Custom…") {
    const input = await hostEditor.showInputBox({
      prompt: "Enter left and right delimiters, separated by a comma",
      placeHolder: "e.g.  {{ , }}",
    });
    if (!input) {
      return;
    }
    const parts = input.split(",");
    left = parts[0]?.trim() ?? "";
    right = parts.length > 1 ? parts.slice(1).join(",").trim() : left;
  }

  const selectedText = hostEditor.getDocumentText(selection);
  await hostEditor.replaceRange(selection, left + selectedText + right);

  // Place cursor after the wrapped text
  const newStart = selection.start.translate(0, left.length);
  const newEnd = doc.positionAt(doc.offsetAt(selection.start) + left.length + selectedText.length);
  hostEditor.setSelection(new Selection(newStart, newEnd));
}
