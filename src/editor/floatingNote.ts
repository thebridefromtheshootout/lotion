import { Position, Range, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Filter } from "../core/cmdFilter";
import type { SlashCommand } from "../core/slashCommands";

// ── /floating-note ─────────────────────────────────────────────────
//
// Inserts a tilted, tape-topped sticky note as a self-contained HTML
// block. All styling is inline so the note renders in VS Code preview
// and any markdown renderer without external CSS. Inspired by the
// ShelfLife album-page sticky notes (see
// ShelfLife/src/app/comps/records-page/records-page.component.css).

const PALETTE = [
  { id: "yellow", label: "🟡  Yellow", description: "Default", bg: "linear-gradient(180deg,#F4E7A4,#E9D27E)" },
  { id: "blue", label: "🔵  Blue", description: "Cool", bg: "linear-gradient(180deg,#C3DCEA,#9DBCD6)" },
  { id: "pink", label: "🧡  Pink", description: "Warm", bg: "linear-gradient(180deg,#F3C7C0,#E2A096)" },
  { id: "green", label: "🟢  Green", description: "Fresh", bg: "linear-gradient(180deg,#C6E0C2,#9CC79A)" },
];

function stickyNoteHtml(bg: string): string {
  const noteStyle = [
    "display:inline-block",
    "position:relative",
    "margin:12px",
    "padding:24px 18px 18px",
    "min-width:170px;max-width:340px",
    "text-align:center",
    "font-family:'Caveat','Comic Sans MS',cursive",
    "font-size:1.22rem;line-height:1.3",
    "color:#241D14",
    `background:${bg}`,
    "box-shadow:0 9px 16px -8px rgba(28,18,6,0.5)",
    "transform:rotate(-3deg)",
  ].join(";");

  const tapeStyle = [
    "position:absolute",
    "top:-8px;left:50%",
    "width:48px;height:16px",
    "transform:translateX(-50%) rotate(-2.5deg)",
    "background:rgba(255,255,255,0.42)",
    "box-shadow:0 1px 2px rgba(0,0,0,0.12)",
  ].join(";");

  return `<div style="${noteStyle}"><span style="${tapeStyle}"></span>\${1:Note text}</div>`;
}

export async function handleFloatingNoteCommand(document: TextDocument, position: Position): Promise<void> {
  const pick = await hostEditor.showQuickPick(
    PALETTE.map((p) => ({ label: p.label, description: p.description, id: p.id })),
    { placeHolder: "Sticky-note color" },
  );
  if (!pick) return;

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) return;

  const bg = PALETTE.find((p) => p.id === pick.id)!.bg;

  const triggerRange = new Range(position.translate(0, -1), position);
  await hostEditor.deleteRange(triggerRange);
  await hostEditor.insertSnippet(new SnippetString(stickyNoteHtml(bg)), hostEditor.getCursorPosition()!);
}

export const FLOATING_NOTE_SLASH_COMMAND: SlashCommand = {
  label: "/floating-note",
  insertText: "",
  detail: "📝 Sticky note (tilted, tape-topped)",
  isAction: true,
  commandId: Cmd.insertFloatingNote,
  kind: 23,
  handler: handleFloatingNoteCommand,
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};
