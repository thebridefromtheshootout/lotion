import type { Position, TextDocument, TextLine } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

import { turnIntoFromHeading } from "./turnIntoFromHeading";
import { turnIntoFromToggleHeading } from "./turnIntoFromToggleHeading";
import { turnIntoFromLink } from "./turnIntoFromLink";

export const TURNINTO_SLASH_COMMAND: SlashCommand = {
  label: "/turninto",
  insertText: "",
  detail: "🔄 Turn heading/link into something else",
  isAction: true,
  commandId: Cmd.turnInto,
  kind: 2,
  cmdFilter: Filter().pageIsNotDbIndex(),
  handler: handleTurnInto,
};

// ── Patterns ───────────────────────────────────────────────────────

const HEADING_RE = Regex.headingLineWithText;
const PAGE_LINK_RE = Regex.markdownPageLinkLine;
const TOGGLE_HEADING_OPEN_RE = Regex.toggleHeadingOpen;

// ── "Turn into…" command ───────────────────────────────────────────

/**
 * Context-aware "Turn into" command.
 *
 * - On a heading line → offer to change level or convert to subpage
 * - On a subpage link line → offer to inline as heading
 *
 * Supports two calling conventions:
 *   1. (doc, pos) — slash-command / slashHandler path
 *   2. () — command palette / keybinding path (uses active editor)
 */
export async function handleTurnInto(docOrNothing?: TextDocument, posOrNothing?: Position): Promise<void> {
  let doc: TextDocument;
  let line: TextLine;

  if (docOrNothing && posOrNothing) {
    await hostEditor.showTextDocument(docOrNothing);
    doc = docOrNothing;
    line = doc.lineAt(posOrNothing.line);
  } else {
    if (!hostEditor.isMarkdownEditor()) {
      return;
    }
    const cursor = hostEditor.getCursorPosition();
    if (!cursor) {
      return;
    }
    const uri = hostEditor.getDocumentUri();
    if (!uri) {
      return;
    }
    doc = await hostEditor.openTextDocument(uri);
    line = doc.lineAt(cursor.line);
  }
  const lineText = line.text;

  const headingMatch = lineText.match(HEADING_RE);
  const linkMatch = lineText.match(PAGE_LINK_RE);
  const toggleMatch = lineText.match(TOGGLE_HEADING_OPEN_RE);

  if (headingMatch) {
    await turnIntoFromHeading(doc, line, headingMatch);
  } else if (toggleMatch) {
    await turnIntoFromToggleHeading(doc, line);
  } else if (linkMatch) {
    await turnIntoFromLink(doc, line, linkMatch);
  } else {
    hostEditor.showInformation("Lotion: Place cursor on a heading or a page link to use Turn Into.");
  }
}
