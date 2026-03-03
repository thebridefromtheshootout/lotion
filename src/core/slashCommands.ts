import { hostEditor } from "../hostEditor/HostingEditor";
import { CompletionItem, CompletionItemKind, Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Cmd } from "./commands";

// ── Import module slash command arrays ─────────────────────────────
import { TABLE_SLASH_COMMANDS } from "../editor/table";
import { EDITOR_SLASH_COMMANDS } from "../editor";
import { BLOCKS_SLASH_COMMANDS } from "../blocks";
import { MEDIA_SLASH_COMMANDS } from "../media";
import { NAVIGATION_SLASH_COMMANDS } from "../navigation";
import { LINKS_SLASH_COMMANDS } from "../links";
import { DATABASE_SLASH_COMMANDS, cursorInDb } from "../database";
import { LISTS_SLASH_COMMANDS } from "../lists";

// ── Slash command definitions ──────────────────────────────────────
export interface SlashCommand {
  label: string;
  insertText: string;
  detail: string;
  /** If true, the command runs custom logic instead of a plain text insert */
  isAction?: boolean;
  /** VS Code command ID to execute for action commands */
  commandId?: string;
  /** If set, only show this command when the predicate returns true */
  when?: (document: TextDocument, position: Position) => boolean;
  /** If true, this command is exclusive to database files and only these commands appear in DB context */
  dbOnly?: boolean;
  /** CompletionItemKind to use for the icon — defaults to Snippet */
  kind?: number;
  /** Handler function for commands that need registration */
  handler?: (doc: TextDocument, pos: Position) => Promise<void>;
}

// ── Static text-insert commands (no handlers needed) ──────────────
const STATIC_SLASH_COMMANDS: SlashCommand[] = [
  { label: "/h1", insertText: "# ", detail: "𝗛  Heading 1 — # ", kind: 0 },
  { label: "/h2", insertText: "## ", detail: "𝗛  Heading 2 — ## ", kind: 0 },
  { label: "/h3", insertText: "### ", detail: "𝗛  Heading 3 — ### ", kind: 0 },
  { label: "/todo", insertText: "- [ ] ", detail: "☑️ To-do checkbox — - [ ] ", kind: 14 },
  { label: "/divider", insertText: "---\n", detail: "➖ Horizontal divider — ---", kind: 11 },
  { label: "/quote", insertText: "> ", detail: "💬 Blockquote — > ", kind: 0 },
  { label: "/math", insertText: "$$\n\n$$", detail: "🧮 LaTeX math block — $$ ... $$", kind: 11 },
  { label: "/inline-math", insertText: "$ $", detail: "🧮 Inline math — $ ... $", kind: 11 },
  {
    label: "/mermaid",
    insertText: "```mermaid\ngraph LR\n  A --> B\n```",
    detail: "🧭 Mermaid diagram block",
    kind: 14,
  },
  {
    label: "/frontmatter",
    insertText: "---\ntitle: \ndate: " + new Date().toISOString().slice(0, 10) + "\ntags: []\n---\n",
    detail: "📋 YAML front matter block",
    kind: 14,
  },
  // Git commit doesn't have a handler yet
  {
    label: "/commit",
    insertText: "",
    detail: "📦 Git: stage all, commit & push",
    isAction: true,
    commandId: Cmd.gitCommit,
    kind: 2,
  },
];

// ── Master list: all slash commands from all modules ───────────────
export const SLASH_COMMANDS: SlashCommand[] = [
  ...STATIC_SLASH_COMMANDS,
  ...TABLE_SLASH_COMMANDS,
  ...EDITOR_SLASH_COMMANDS,
  ...BLOCKS_SLASH_COMMANDS,
  ...MEDIA_SLASH_COMMANDS,
  ...NAVIGATION_SLASH_COMMANDS,
  ...LINKS_SLASH_COMMANDS,
  ...DATABASE_SLASH_COMMANDS,
  ...LISTS_SLASH_COMMANDS,
];

// ── Completion provider factory ────────────────────────────────────
export function createSlashCompletionProvider(): Disposable {
  return hostEditor.registerCompletionItemProvider(
    { language: "markdown" },
    {
      provideCompletionItems(document: TextDocument, position: Position): CompletionItem[] | undefined {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);

        if (!linePrefix.endsWith("/")) {
          return undefined;
        }

        // If inside a DB file, only show dbOnly commands
        const inDb = cursorInDb(document, position);
        const visibleCmds = inDb
          ? SLASH_COMMANDS.filter((cmd) => cmd.dbOnly && (!cmd.when || cmd.when(document, position)))
          : SLASH_COMMANDS.filter((cmd) => !cmd.dbOnly && (!cmd.when || cmd.when(document, position)));

        return visibleCmds.map((cmd) => {
          const item = new CompletionItem(cmd.label, cmd.kind ?? CompletionItemKind.Snippet);
          item.detail = cmd.detail;
          item.filterText = cmd.label;
          item.sortText = cmd.label;

          const replaceRange = new Range(position.translate(0, -1), position);
          item.range = replaceRange;

          if (cmd.isAction && cmd.commandId) {
            item.insertText = "";
            const command = cmd.commandId;
            item.command = {
              title: cmd.detail,
              command,
              arguments: [document.uri.toString(), position.line, position.character],
            };
          } else {
            item.insertText = cmd.insertText;
          }

          return item;
        });
      },
    },
    "/",
  );
}
