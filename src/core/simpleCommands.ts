// ── Simple commands registry ────────────────────────────────────────
// Command ID → handler mappings that use straightforward registerCommand

import { Position, Uri } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "./commands";
import { matchesSavedHash } from "./fileHashTracker";

// Editor handlers
import { handleUpdateDate, editFrontmatter, handleSmartPaste, addComment } from "../editor";
// import { toggleFocusMode } from "../editor"; // disabled

// Block handlers
import { swapBlockUp, swapBlockDown, handleDuplicateBlock, selectBlock } from "../blocks";

// Formatting handlers
import { promoteHeading, demoteHeading /* , wrapWith */ } from "../formatting";

// Link handlers
import { convertLinksToReference, convertLinksToInline } from "../links";

// List handlers
import { toggleCheckbox, handleListContinue, indentListItem, outdentListItem /* , toggleListType */ } from "../lists";

// Navigation handlers
import {
  handleExtractToSubpage,
  jumpToNextHeading,
  jumpToPrevHeading,
  jumpToHeadingPicker,
  findOrphanPages,
  quickSwitchPage,
  showRecentPages,
  renamePage,
  movePage,
  // showTagIndex,
  // wikiSearch,
} from "../navigation";

// Media handlers
// import { findUnusedImages } from "../media"; // disabled

// View handlers
import { revealHeading, setPageIcon } from "../views";

// Productivity handlers
import {
  bookmarkPage,
  removeBookmark,
  openBookmark,
  pasteFromHistory,
  openDailyNote,
  // pomodoroStart, // disabled
  // pomodoroBreak, // disabled
  // pomodoroStop, // disabled
  handleGitCommitCommand,
  fireInto,
} from "../productivity";

// ── Slash handler wrapper ──────────────────────────────────────────

export type SlashCommandHandler = (doc: TextDocument, pos: Position) => Promise<void>;

/**
 * Wrap a (document, position) handler so it can be invoked:
 *   1. From the slash-command completion provider → (docUri, line, character)
 *   2. From the Ctrl+Shift+P command palette → no args (falls back to active editor)
 */
export function slashHandler(handler: SlashCommandHandler): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    let doc: TextDocument;
    let pos: Position;
    let viaSlash = false;

    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "number" && typeof args[2] === "number") {
      // Slash-command path: (docUri, line, character)
      doc = await hostEditor.openTextDocument(Uri.parse(args[0]));
      pos = new Position(args[1], args[2]);
      viaSlash = true;
    } else {
      // Command palette / keybinding path: use active editor
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
  // [Cmd.toggleFocusMode, toggleFocusMode], // disabled
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
  // [Cmd.wrapWith, wrapWith],  // disabled
  // Links
  [Cmd.linksToReference, convertLinksToReference],
  [Cmd.linksToInline, convertLinksToInline],
  // Lists
  [Cmd.listContinue, handleListContinue],
  [Cmd.toggleCheckbox, toggleCheckbox],
  [Cmd.indentList, indentListItem],
  [Cmd.outdentList, outdentListItem],
  // [Cmd.toggleListType, toggleListType],  // disabled
  // Navigation
  [Cmd.jumpToNextHeading, jumpToNextHeading],
  [Cmd.jumpToPrevHeading, jumpToPrevHeading],
  [Cmd.jumpToHeading, jumpToHeadingPicker],
  [Cmd.findOrphanPages, findOrphanPages],
  [Cmd.extractToSubpage, handleExtractToSubpage],
  // [Cmd.showTagIndex, showTagIndex], // disabled
  [Cmd.recentPages, showRecentPages],
  [Cmd.renamePage, renamePage],
  [Cmd.movePage, movePage],
  [Cmd.quickSwitch, quickSwitchPage],
  // [Cmd.wikiSearch, wikiSearch], // disabled
  // Media
  // [Cmd.findUnusedImages, findUnusedImages], // disabled
  // Views
  [Cmd.revealHeading, revealHeading],
  [Cmd.setPageIcon, setPageIcon],
  // Productivity
  [Cmd.bookmarkPage, bookmarkPage],
  [Cmd.removeBookmark, removeBookmark],
  [Cmd.openBookmark, openBookmark],
  [Cmd.pasteFromHistory, pasteFromHistory],
  [Cmd.openDailyNote, openDailyNote],
  // [Cmd.pomodoroStart, pomodoroStart], // disabled
  // [Cmd.pomodoroBreak, pomodoroBreak], // disabled
  // [Cmd.pomodoroStop, pomodoroStop], // disabled
  [Cmd.gitCommit, slashHandler(handleGitCommitCommand)],
  [Cmd.fireInto, fireInto],
];
