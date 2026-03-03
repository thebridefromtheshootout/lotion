
import { Position, Range, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const TOGGLE_H1_SLASH_COMMAND: SlashCommand = {
  label: "/th1",
  insertText: "",
  detail: "\u25b6 Toggle heading 1 (collapsible)",
  isAction: true,
  commandId: Cmd.insertToggleH1,
  kind: 14,
  handler: handleToggleHeadingCommand(1),
};

export const TOGGLE_H2_SLASH_COMMAND: SlashCommand = {
  label: "/th2",
  insertText: "",
  detail: "\u25b6 Toggle heading 2 (collapsible)",
  isAction: true,
  commandId: Cmd.insertToggleH2,
  kind: 14,
  handler: handleToggleHeadingCommand(2),
};

export const TOGGLE_H3_SLASH_COMMAND: SlashCommand = {
  label: "/th3",
  insertText: "",
  detail: "\u25b6 Toggle heading 3 (collapsible)",
  isAction: true,
  commandId: Cmd.insertToggleH3,
  kind: 14,
  handler: handleToggleHeadingCommand(3),
};

export const TOGGLE_SLASH_COMMAND: SlashCommand = {
  label: "/toggle",
  insertText: "",
  detail: "\u25b6 Collapsible toggle block",
  isAction: true,
  commandId: Cmd.insertToggle,
  kind: 14,
  handler: handleToggleCommand,
};

export const CALLOUT_SLASH_COMMAND: SlashCommand = {
  label: "/callout",
  insertText: "",
  detail: "\ud83d\udce2 Callout block (NOTE, TIP, WARNING...)",
  isAction: true,
  commandId: Cmd.insertCallout,
  kind: 23,
  handler: handleCalloutCommand,
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
