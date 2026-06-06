import { Position, Range, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

export const TOGGLE_H1_SLASH_COMMAND: SlashCommand = {
  label: "/th1",
  insertText: "",
  detail: "\u25b6 Toggle heading 1 (collapsible)",
  isAction: true,
  commandId: Cmd.insertToggleH1,
  kind: 14,
  handler: handleToggleHeadingCommand(1),
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};

export const TOGGLE_H2_SLASH_COMMAND: SlashCommand = {
  label: "/th2",
  insertText: "",
  detail: "\u25b6 Toggle heading 2 (collapsible)",
  isAction: true,
  commandId: Cmd.insertToggleH2,
  kind: 14,
  handler: handleToggleHeadingCommand(2),
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};

export const TOGGLE_H3_SLASH_COMMAND: SlashCommand = {
  label: "/th3",
  insertText: "",
  detail: "\u25b6 Toggle heading 3 (collapsible)",
  isAction: true,
  commandId: Cmd.insertToggleH3,
  kind: 14,
  handler: handleToggleHeadingCommand(3),
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};

export const TOGGLE_SLASH_COMMAND: SlashCommand = {
  label: "/toggle",
  insertText: "",
  detail: "\u25b6 Collapsible toggle block",
  isAction: true,
  commandId: Cmd.insertToggle,
  kind: 14,
  handler: handleToggleCommand,
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};

export const TOGGLE_LIST_SLASH_COMMAND: SlashCommand = {
  label: "/tl",
  insertText: "",
  detail: "▶ Collapsible list item (ul)",
  isAction: true,
  commandId: Cmd.insertToggleList,
  kind: 14,
  handler: handleToggleListCommand,
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};

export const TOGGLE_OL_SLASH_COMMAND: SlashCommand = {
  label: "/tol",
  insertText: "",
  detail: "▶ Collapsible list item (ol)",
  isAction: true,
  commandId: Cmd.insertToggleOl,
  kind: 14,
  handler: handleToggleOlCommand,
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};

export const WRAP_LIST_SLASH_COMMAND: SlashCommand = {
  label: "/wrap-list",
  insertText: "",
  detail: "▶ Wrap list item + children as collapsible",
  isAction: true,
  commandId: Cmd.wrapListCollapsible,
  kind: 14,
  handler: handleWrapListCommand,
  cmdFilter: Filter().pageIsNotDbIndex().cursorInList(),
};

export const CALLOUT_SLASH_COMMAND: SlashCommand = {
  label: "/callout",
  insertText: "",
  detail: "\ud83d\udce2 Callout block (NOTE, TIP, WARNING...)",
  isAction: true,
  commandId: Cmd.insertCallout,
  kind: 23,
  handler: handleCalloutCommand,
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  cleanLine: true,
};

// ── /toggle handler ────────────────────────────────────────────────
export async function handleToggleCommand(document: TextDocument, position: Position) {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const triggerRange = new Range(position.translate(0, -1), position);

  await hostEditor.deleteRange(triggerRange);

  const snippet = new SnippetString("<details>\n<summary>${1:Summary}</summary>\n\n${0}\n\n</details>");

  await hostEditor.insertSnippet(snippet, hostEditor.getCursorPosition()!);
}

// ── Toggle heading handlers ────────────────────────────────────────

export function handleToggleHeadingCommand(level: number) {
  return async (document: TextDocument, position: Position) => {
    if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
      return;
    }

    const triggerRange = new Range(position.translate(0, -1), position);

    await hostEditor.deleteRange(triggerRange);

    const hTag = `h${level}`;
    const snippet = new SnippetString(
      `<details>\n<summary><${hTag}>\${1:Heading}</${hTag}></summary>\n\n\${0}\n\n</details>`,
    );

    await hostEditor.insertSnippet(snippet, hostEditor.getCursorPosition()!);
  };
}

// ── /tl handler ────────────────────────────────────────────────────
export async function handleToggleListCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) return;
  await hostEditor.deleteRange(new Range(position.translate(0, -1), position));
  const snippet = new SnippetString("- <details><summary>${1:Summary}</summary>\n\n  - ${0}\n\n</details>");
  await hostEditor.insertSnippet(snippet, hostEditor.getCursorPosition()!);
}

// ── /tol handler ───────────────────────────────────────────────────
export async function handleToggleOlCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) return;
  await hostEditor.deleteRange(new Range(position.translate(0, -1), position));
  const snippet = new SnippetString("1. <details><summary>${1:Summary}</summary>\n\n   1. ${0}\n\n</details>");
  await hostEditor.insertSnippet(snippet, hostEditor.getCursorPosition()!);
}

// ── /wrap-list handler ─────────────────────────────────────────────
export async function handleWrapListCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) return;

  const lineText = document.lineAt(position.line).text;
  const match = lineText.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
  if (!match) return;

  const [, indent, marker, rawText] = match;
  const summaryText = rawText.trimEnd();
  const baseIndent = indent.length;

  // Find the last non-blank line that is more indented than the current item
  let lastChildLine = position.line;
  for (let i = position.line + 1; i < document.lineCount; i++) {
    const t = document.lineAt(i).text;
    if (t.trim().length === 0) continue;
    if ((t.match(/^(\s*)/)?.[1].length ?? 0) > baseIndent) {
      lastChildLine = i;
    } else {
      break;
    }
  }

  // Collect children, trimming leading/trailing blank lines
  const childLines: string[] = [];
  for (let i = position.line + 1; i <= lastChildLine; i++) {
    childLines.push(document.lineAt(i).text);
  }
  while (childLines.length > 0 && childLines[0].trim() === "") childLines.shift();
  while (childLines.length > 0 && childLines[childLines.length - 1].trim() === "") childLines.pop();

  const bodyIndent = indent + " ".repeat(marker.length + 1);
  const body = childLines.length > 0 ? childLines : [`${bodyIndent}- `];

  const result = [
    `${indent}${marker} <details><summary>${summaryText}</summary>`,
    "",
    ...body,
    "",
    `${indent}</details>`,
  ].join("\n");

  await hostEditor.replaceRange(
    new Range(new Position(position.line, 0), new Position(lastChildLine, document.lineAt(lastChildLine).text.length)),
    result,
  );
}

// ── /callout handler ───────────────────────────────────────────────
const CALLOUT_TYPES = [
  { label: "NOTE", description: "Informational callout", icon: "ℹ️" },
  { label: "TIP", description: "Helpful tip", icon: "💡" },
  { label: "IMPORTANT", description: "Important information", icon: "❗" },
  { label: "WARNING", description: "Warning message", icon: "⚠️" },
  { label: "CAUTION", description: "Dangerous action warning", icon: "🔴" },
];

export async function handleCalloutCommand(document: TextDocument, position: Position) {
  const pick = await hostEditor.showQuickPick(
    CALLOUT_TYPES.map((t) => ({
      label: `${t.icon}  ${t.label}`,
      description: t.description,
      id: t.label,
    })),
    { placeHolder: "Select callout type" },
  );

  if (!pick) {
    return;
  }

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const triggerRange = new Range(position.translate(0, -1), position);

  await hostEditor.deleteRange(triggerRange);

  const snippet = new SnippetString(`> [!${pick.id}]\n> \${0}`);

  await hostEditor.insertSnippet(snippet, hostEditor.getCursorPosition()!);
}
