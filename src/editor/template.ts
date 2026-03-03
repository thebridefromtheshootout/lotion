
import { hostEditor } from "../hostEditor/HostingEditor";
import { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const TEMPLATE_SLASH_COMMAND: SlashCommand = {
  label: "/template",
  insertText: "",
  detail: "\ud83d\udcc4 Insert a page template",
  isAction: true,
  commandId: Cmd.insertTemplate,
  kind: 16,
  handler: handleTemplateCommand,
};
// ── /template handler ──────────────────────────────────────────────
//
// Presents a quick pick of common page templates (meeting notes, blog
// post, project doc, etc.) and inserts the chosen template at the
// cursor position.

interface Template {
  label: string;
  detail: string;
  body: string;
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const TEMPLATES: Template[] = [
  {
    label: "Meeting Notes",
    detail: "Attendees, agenda, action items",
    body: [
      "---",
      `date: ${todayISO()}`,
      "type: meeting",
      "---",
      "",
      "# Meeting Notes",
      "",
      "## Attendees",
      "",
      "- ",
      "",
      "## Agenda",
      "",
      "1. ",
      "",
      "## Discussion",
      "",
      "",
      "",
      "## Action Items",
      "",
      "- [ ] ",
      "",
    ].join("\n"),
  },
  {
    label: "Blog Post",
    detail: "Title, summary, body, tags",
    body: [
      "---",
      "title: ",
      `date: ${todayISO()}`,
      "tags: []",
      "draft: true",
      "---",
      "",
      "# Title",
      "",
      "> One-line summary.",
      "",
      "## Introduction",
      "",
      "",
      "",
      "## Body",
      "",
      "",
      "",
      "## Conclusion",
      "",
      "",
      "",
    ].join("\n"),
  },
  {
    label: "Project Brief",
    detail: "Goal, scope, timeline, stakeholders",
    body: [
      "---",
      `date: ${todayISO()}`,
      "type: project",
      "status: draft",
      "---",
      "",
      "# Project Brief",
      "",
      "## Goal",
      "",
      "",
      "",
      "## Scope",
      "",
      "- ",
      "",
      "## Timeline",
      "",
      "| Phase | Start | End | Status |",
      "| ----- | ----- | --- | ------ |",
      "|       |       |     |        |",
      "",
      "## Stakeholders",
      "",
      "- ",
      "",
      "## Open Questions",
      "",
      "- ",
      "",
    ].join("\n"),
  },
  {
    label: "Daily Journal",
    detail: "Gratitude, tasks, reflections",
    body: [
      "---",
      `date: ${todayISO()}`,
      "type: journal",
      "---",
      "",
      `# ${todayISO()}`,
      "",
      "## Grateful For",
      "",
      "1. ",
      "",
      "## Today's Priorities",
      "",
      "- [ ] ",
      "",
      "## Notes",
      "",
      "",
      "",
      "## End-of-Day Reflection",
      "",
      "",
      "",
    ].join("\n"),
  },
  {
    label: "Decision Record",
    detail: "Context, options, decision, consequences",
    body: [
      "---",
      `date: ${todayISO()}`,
      "type: adr",
      "status: proposed",
      "---",
      "",
      "# Decision: ",
      "",
      "## Context",
      "",
      "",
      "",
      "## Options Considered",
      "",
      "### Option 1",
      "",
      "- **Pros:** ",
      "- **Cons:** ",
      "",
      "### Option 2",
      "",
      "- **Pros:** ",
      "- **Cons:** ",
      "",
      "## Decision",
      "",
      "",
      "",
      "## Consequences",
      "",
      "- ",
      "",
    ].join("\n"),
  },
];

export async function handleTemplateCommand(document: TextDocument, position: Position): Promise<void> {
  const pick = await hostEditor.showQuickPick(TEMPLATES, {
    placeHolder: "Choose a page template",
    matchOnDetail: true,
  });

  if (!pick) {
    return;
  }

  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  await hostEditor.insertAt(position, pick.body);
}
