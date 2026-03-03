
import { Position, Range, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const CODE_SLASH_COMMAND: SlashCommand = {
  label: "/code",
  insertText: "",
  detail: "\ud83d\udd23 Fenced code block",
  isAction: true,
  commandId: Cmd.insertCodeBlock,
  kind: 14,
  handler: handleCodeBlockCommand,
};

const POPULAR_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "html",
  "css",
  "sql",
  "bash",
  "powershell",
  "json",
  "yaml",
  "xml",
  "markdown",
  "plaintext",
];

// ── /code handler ──────────────────────────────────────────────────
export async function handleCodeBlockCommand(document: TextDocument, position: Position) {
  const language = await hostEditor.showQuickPick(POPULAR_LANGUAGES, {
    placeHolder: "Select language for the code block",
  });

  if (language === undefined) {
    return; // user cancelled
  }

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const triggerRange = new Range(position.translate(0, -1), position);

  const snippet = new SnippetString();
  snippet.appendText(`\`\`\`${language}\n`);
  snippet.appendTabstop(0);
  snippet.appendText("\n```");

  await hostEditor.deleteRange(triggerRange);

  await hostEditor.insertSnippet(snippet, hostEditor.getCursorPosition()!);
}
