// ── Editor module barrel ────────────────────────────────────────────
export {
  handleToggleCommand,
  handleCalloutCommand,
  handleToggleHeadingCommand,
  handleToggleListCommand,
  handleToggleOlCommand,
  handleWrapListCommand,
} from "./callout";
export { handleCodeBlockCommand } from "./codeBlock";
export { cursorInCodeContext } from "./codeContext";
export {
  handleTodayCommand,
  handleDateCommand,
  handleUpdateDate,
  createDateCodeLensProvider,
  generateDateLenses,
} from "./date";
export { handleEmojiCommand } from "./emoji";
export { handleFootnoteCommand } from "./footnote";
export { editFrontmatter } from "./frontmatterEditor";
export { handleSmartPaste } from "./smartPaste";
export { TABLE_SLASH_COMMANDS, tableKeybindingCommands, cursorInTable } from "./table";
export { createTableAlignOnSave } from "./tableAlignOnSave";
export { handleTocCommand, createTocAutoUpdater } from "./toc";
export { addComment, resolveComment, deleteComment, createCommentCodeLensProvider, showCommentPanel } from "./comments";
export {
  handleProcessorCommand,
  handleRefreshCommand,
  handleUpdateProcessorCommand,
  createProcessorCodeLensProvider,
  generateProcessorLenses,
  cursorInProcessor,
} from "./processor";
export { createEditorDecorations } from "./editorDecorations";
export { searchWorkspaceCommands } from "./searchCommands";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import {
  TOGGLE_H1_SLASH_COMMAND,
  TOGGLE_H2_SLASH_COMMAND,
  TOGGLE_H3_SLASH_COMMAND,
  TOGGLE_SLASH_COMMAND,
  TOGGLE_LIST_SLASH_COMMAND,
  TOGGLE_OL_SLASH_COMMAND,
  WRAP_LIST_SLASH_COMMAND,
  CALLOUT_SLASH_COMMAND,
} from "./callout";
import { BLOCK_INSERT_SLASH_COMMANDS } from "./blockInserts";
import { CODE_SLASH_COMMAND } from "./codeBlock";
import { COPY_SLASH_COMMAND } from "./copyCode";
import { TODAY_SLASH_COMMAND } from "./date/dateCommands";
import { DATE_SLASH_COMMAND } from "./date/datePanel";
import { EMOJI_SLASH_COMMAND } from "./emoji";
import { FOOTNOTE_SLASH_COMMAND } from "./footnote";
import { TOC_SLASH_COMMAND } from "./toc";
import { COMMENTS_SLASH_COMMAND } from "./comments/commentPanel";
import { PROCESSOR_SLASH_COMMAND, REFRESH_SLASH_COMMAND, UPDATE_PROCESSOR_SLASH_COMMAND } from "./processor";

export const EDITOR_SLASH_COMMANDS: SlashCommand[] = [
  ...BLOCK_INSERT_SLASH_COMMANDS,
  TOGGLE_H1_SLASH_COMMAND,
  TOGGLE_H2_SLASH_COMMAND,
  TOGGLE_H3_SLASH_COMMAND,
  TOGGLE_SLASH_COMMAND,
  TOGGLE_LIST_SLASH_COMMAND,
  TOGGLE_OL_SLASH_COMMAND,
  WRAP_LIST_SLASH_COMMAND,
  CALLOUT_SLASH_COMMAND,
  CODE_SLASH_COMMAND,
  COPY_SLASH_COMMAND,
  TODAY_SLASH_COMMAND,
  DATE_SLASH_COMMAND,
  EMOJI_SLASH_COMMAND,
  FOOTNOTE_SLASH_COMMAND,
  TOC_SLASH_COMMAND,
  COMMENTS_SLASH_COMMAND,
  PROCESSOR_SLASH_COMMAND,
  REFRESH_SLASH_COMMAND,
  UPDATE_PROCESSOR_SLASH_COMMAND,
];
