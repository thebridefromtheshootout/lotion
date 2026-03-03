
import { Position, Range, Selection, TextEditorRevealType } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const FOOTNOTE_SLASH_COMMAND: SlashCommand = {
  label: "/footnote",
  insertText: "",
  detail: "\ud83d\udcdd Insert a numbered footnote",
  isAction: true,
  commandId: Cmd.insertFootnote,
  kind: 17,
  handler: handleFootnoteCommand,
};

// ── /footnote handler ──────────────────────────────────────────────
//
// Inserts a markdown footnote reference at the cursor and appends the
// footnote definition at the bottom of the document. Automatically
// numbers the footnote based on existing footnotes.

const FOOTNOTE_REF_RE = /\[\^(\d+)\]/g;

export async function handleFootnoteCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  // Find the highest existing footnote number
  const text = document.getText();
  let maxNum = 0;
  let match: RegExpExecArray | null;
  while ((match = FOOTNOTE_REF_RE.exec(text)) !== null) {
    const n = parseInt(match[1], 10);
    if (n > maxNum) {
      maxNum = n;
    }
  }

  const nextNum = maxNum + 1;
  const refText = `[^${nextNum}]`;
  const defText = `[^${nextNum}]: `;

  // Insert reference at cursor and append definition at end of document
  const lastLine = document.lineCount - 1;
  const lastLineText = document.lineAt(lastLine).text;
  const prefix = lastLineText.trim() === "" ? "" : "\n";
  await hostEditor.batchInsertAt([
    { position: position, text: refText },
    { position: new Position(lastLine + 1, 0), text: `${prefix}\n${defText}\n` },
  ]);

  // Move cursor to the footnote definition so user can type it
  // We need to find the line with the definition — scan backwards
  const lineCount = hostEditor.getLineCount();
  for (let i = lineCount - 1; i >= 0; i--) {
    if (hostEditor.getLineText(i).startsWith(`[^${nextNum}]: `)) {
      const col = `[^${nextNum}]: `.length;
      const pos = new Position(i, col);
      hostEditor.setSelection(new Selection(pos, pos));
      hostEditor.revealRange(new Range(pos, pos), TextEditorRevealType.InCenter);
      break;
    }
  }
}
