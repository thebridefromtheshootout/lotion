
import { Position, Range, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

const pageFilter = Filter().pageIsNotDbIndex();

// ── Factory ────────────────────────────────────────────────────────
// text may be a string or a thunk (for values computed at call time, e.g. today's date)
function blockInsertHandler(text: string | (() => string)) {
  return async (document: TextDocument, position: Position): Promise<void> => {
    if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
      return;
    }
    const triggerRange = new Range(position.translate(0, -1), position);
    await hostEditor.deleteRange(triggerRange);
    const content = typeof text === "function" ? text() : text;
    await hostEditor.insertSnippet(new SnippetString(content), hostEditor.getCursorPosition()!);
  };
}

// ── Slash command definitions ──────────────────────────────────────

export const BLOCK_INSERT_SLASH_COMMANDS: SlashCommand[] = [
  {
    label: "/h1",
    insertText: "",
    detail: "𝗛  Heading 1 — # ",
    isAction: true,
    commandId: Cmd.insertH1,
    kind: 0,
    handler: blockInsertHandler("# "),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/h2",
    insertText: "",
    detail: "𝗛  Heading 2 — ## ",
    isAction: true,
    commandId: Cmd.insertH2,
    kind: 0,
    handler: blockInsertHandler("## "),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/h3",
    insertText: "",
    detail: "𝗛  Heading 3 — ### ",
    isAction: true,
    commandId: Cmd.insertH3,
    kind: 0,
    handler: blockInsertHandler("### "),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/todo",
    insertText: "",
    detail: "☑️ To-do checkbox — - [ ] ",
    isAction: true,
    commandId: Cmd.insertTodo,
    kind: 14,
    handler: blockInsertHandler("- [ ] "),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/divider",
    insertText: "",
    detail: "➖ Horizontal divider — ---",
    isAction: true,
    commandId: Cmd.insertDivider,
    kind: 11,
    handler: blockInsertHandler("---\n"),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/quote",
    insertText: "",
    detail: "💬 Blockquote — > ",
    isAction: true,
    commandId: Cmd.insertQuote,
    kind: 0,
    handler: blockInsertHandler("> "),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/math",
    insertText: "",
    detail: "🧮 LaTeX math block — $$ ... $$",
    isAction: true,
    commandId: Cmd.insertMath,
    kind: 11,
    handler: blockInsertHandler("$$\n\n$$"),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/mermaid",
    insertText: "",
    detail: "🧭 Mermaid diagram block",
    isAction: true,
    commandId: Cmd.insertMermaid,
    kind: 14,
    handler: blockInsertHandler("```mermaid\ngraph LR\n  A --> B\n```"),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
  {
    label: "/frontmatter",
    insertText: "",
    detail: "📋 YAML front matter block",
    isAction: true,
    commandId: Cmd.insertFrontmatter,
    kind: 14,
    handler: blockInsertHandler(
      () => `---\ntitle: \ndate: ${new Date().toISOString().slice(0, 10)}\ntags: []\n---\n`,
    ),
    cmdFilter: pageFilter,
    cleanLine: true,
  },
];
