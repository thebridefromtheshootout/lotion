// ── Editor module barrel ────────────────────────────────────────────
export { handleToggleCommand, handleCalloutCommand, handleToggleHeadingCommand } from "./callout";
export { handleCodeBlockCommand } from "./codeBlock";
export {
  handleTodayCommand,
  handleDateCommand,
  handleUpdateDate,
  createDateCodeLensProvider,
  generateDateLenses,
} from "./date";
export { handleEmojiCommand } from "./emoji";
// export { toggleFocusMode } from "./focusMode"; // disabled
export { handleFootnoteCommand } from "./footnote";
export { editFrontmatter } from "./frontmatterEditor";
export { handleSmartPaste } from "./smartPaste";
export { createSnippetExpander } from "./snippetExpander";
export { TABLE_SLASH_COMMANDS, tableKeybindingCommands, cursorInTable } from "./table";
// export { handleTemplateCommand } from "./template"; // disabled
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
export { handleDictateCommand } from "./dictate";
export { createEditorDecorations } from "./editorDecorations";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import {
  TOGGLE_H1_SLASH_COMMAND,
  TOGGLE_H2_SLASH_COMMAND,
  TOGGLE_H3_SLASH_COMMAND,
  TOGGLE_SLASH_COMMAND,
  CALLOUT_SLASH_COMMAND,
} from "./callout";
import { CODE_SLASH_COMMAND } from "./codeBlock";
import { TODAY_SLASH_COMMAND } from "./date/dateCommands";
import { DATE_SLASH_COMMAND } from "./date/datePanel";
import { EMOJI_SLASH_COMMAND } from "./emoji";
import { FOOTNOTE_SLASH_COMMAND } from "./footnote";
// import { TEMPLATE_SLASH_COMMAND } from "./template"; // disabled
import { TOC_SLASH_COMMAND } from "./toc";
import { COMMENTS_SLASH_COMMAND } from "./comments/commentPanel";
import {
  PROCESSOR_SLASH_COMMAND,
  REFRESH_SLASH_COMMAND,
  UPDATE_PROCESSOR_SLASH_COMMAND,
} from "./processor";

export const EDITOR_SLASH_COMMANDS: SlashCommand[] = [
  TOGGLE_H1_SLASH_COMMAND,
  TOGGLE_H2_SLASH_COMMAND,
  TOGGLE_H3_SLASH_COMMAND,
  TOGGLE_SLASH_COMMAND,
  CALLOUT_SLASH_COMMAND,
  CODE_SLASH_COMMAND,
  TODAY_SLASH_COMMAND,
  DATE_SLASH_COMMAND,
  EMOJI_SLASH_COMMAND,
  FOOTNOTE_SLASH_COMMAND,
  // TEMPLATE_SLASH_COMMAND, // disabled
  TOC_SLASH_COMMAND,
  COMMENTS_SLASH_COMMAND,
  PROCESSOR_SLASH_COMMAND,
  REFRESH_SLASH_COMMAND,
  UPDATE_PROCESSOR_SLASH_COMMAND,
];
