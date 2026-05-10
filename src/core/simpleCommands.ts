// ── Simple commands registry ────────────────────────────────────────
// Command ID → handler mappings that use straightforward registerCommand

import { Position, Range, Uri } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "./commands";
import { parseCommandArgs } from "./commandArgs";
import { Regex } from "./regex";
import { matchesSavedHash } from "./fileHashTracker";

// Editor handlers
import { handleUpdateDate, editFrontmatter, handleSmartPaste, addComment, searchWorkspaceCommands } from "../editor";

// Block handlers
import { swapBlockUp, swapBlockDown, handleDuplicateBlock, selectBlock } from "../blocks";

// Formatting handlers
import { promoteHeading, demoteHeading } from "../formatting";

// Link handlers
import { convertLinksToReference, convertLinksToInline, searchWorkspaceLinks } from "../links";

// List handlers
import { toggleCheckbox, handleListContinue, indentListItem, outdentListItem } from "../lists";

// Navigation handlers
import {
  handleExtractToSubpage,
  jumpToNextHeading,
  jumpToPrevHeading,
  jumpToHeadingPicker,
  findOrphanPages,
  quickSwitchPage,
  showRecentPages,
} from "../navigation";

// View handlers
import { revealHeading, setPageIcon } from "../views";

// Productivity handlers
import {
  bookmarkPage,
  removeBookmark,
  openBookmark,
  openDailyNote,
  handleGitCommitCommand,
  fireInto,
} from "../productivity";

// ── Slash handler wrapper ──────────────────────────────────────────

export type SlashCommandHandler = (doc: TextDocument, pos: Position) => Promise<void>;

async function cleanMarkerLine(doc: TextDocument, lineNumber: number): Promise<void> {
  const lineText = doc.lineAt(lineNumber).text;
  const indent = lineText.match(Regex.lineIndent)?.[1] ?? "";
  const content = lineText.slice(indent.length);
  if (content.length > 0 && Regex.emptyLineMarker.test(content)) {
    await hostEditor.replaceRange(
      new Range(new Position(lineNumber, indent.length), new Position(lineNumber, lineText.length)),
      "",
    );
  }
}

/**
 * Wrap a (document, position) handler so it can be invoked:
 *   1. From the slash-command completion provider → (docUri, line, character)
 *   2. From the Ctrl+Shift+P command palette → no args (falls back to active editor)
 */
export function slashHandler(handler: SlashCommandHandler, cleanLine?: boolean): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    let doc: TextDocument;
    let pos: Position;
    let viaSlash = false;

    const parsed = parseCommandArgs(args);
    if (parsed.kind === "slash") {
      doc = await hostEditor.openTextDocument(Uri.parse(parsed.docUri));
      pos = new Position(parsed.line, parsed.character);
      viaSlash = true;
    } else {
      // Command palette / keybinding / fsPath path: use active editor.
      const activeDoc = hostEditor.getDocument();
      if (!activeDoc) {
        hostEditor.showWarning("Lotion: No active editor. Open a Markdown file first.");
        return;
      }
      if (!hostEditor.isMarkdownEditor()) {
        hostEditor.showWarning("Lotion: This command only works in Markdown files.");
        return;
      }
      doc = activeDoc;
      pos = hostEditor.getCursorPosition()!;
    }

    if (cleanLine) {
      await cleanMarkerLine(doc, pos.line);
    }

    await handler(doc, pos);

    // ── Preserve dirty state ───────────────────────────────────────
    // When triggered via slash completion the document is left dirty even
    // though the net content change is zero (the typed "/cmd" text was
    // replaced with ""). Compare the current content hash against our
    // saved-file hash map: if they match the file had no unsaved edits
    // before the user typed the slash command, so revert to clear the
    // dirty indicator. Otherwise leave the document unsaved.
    if (viaSlash && doc.isDirty && matchesSavedHash(doc)) {
      await doc.save();
    }
  };
}

// ── Simple commands array ──────────────────────────────────────────

/**
 * Array of [commandId, handler] tuples for simple command registration.
 * Each is registered via commands.registerCommand(id, handler).
 */
export const SIMPLE_COMMANDS: [string, (...args: any[]) => any][] = [
  // Editor
  [Cmd.smartPaste, handleSmartPaste],
  [Cmd.editFrontmatter, editFrontmatter],
  [Cmd.addComment, addComment],
  // Blocks
  [Cmd.duplicateBlock, handleDuplicateBlock],
  [Cmd.selectBlock, selectBlock],
  [Cmd.swapBlockUp, swapBlockUp],
  [Cmd.swapBlockDown, swapBlockDown],
  // Formatting
  [Cmd.promoteHeading, promoteHeading],
  [Cmd.demoteHeading, demoteHeading],
  // Links
  [Cmd.linksToReference, convertLinksToReference],
  [Cmd.linksToInline, convertLinksToInline],
  [Cmd.searchWorkspaceLinks, searchWorkspaceLinks],
  [Cmd.searchWorkspaceCommands, searchWorkspaceCommands],
  // Lists
  [Cmd.listContinue, handleListContinue],
  [Cmd.toggleCheckbox, toggleCheckbox],
  [Cmd.indentList, indentListItem],
  [Cmd.outdentList, outdentListItem],
  // Navigation
  [Cmd.jumpToNextHeading, jumpToNextHeading],
  [Cmd.jumpToPrevHeading, jumpToPrevHeading],
  [Cmd.jumpToHeading, jumpToHeadingPicker],
  [Cmd.findOrphanPages, findOrphanPages],
  [Cmd.extractToSubpage, handleExtractToSubpage],
  [Cmd.recentPages, showRecentPages],
  [Cmd.quickSwitch, quickSwitchPage],
  // Views
  [Cmd.revealHeading, revealHeading],
  [Cmd.setPageIcon, setPageIcon],
  // Productivity
  [Cmd.bookmarkPage, bookmarkPage],
  [Cmd.removeBookmark, removeBookmark],
  [Cmd.openBookmark, openBookmark],
  [Cmd.openDailyNote, openDailyNote],
  [Cmd.gitCommit, handleGitCommitCommand],
  [Cmd.fireInto, fireInto],
];
