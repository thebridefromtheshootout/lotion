// ── Lists module barrel ─────────────────────────────────────────────
export { toggleCheckbox } from "./checkbox";
export { handleListContinue } from "./listContinue";
export { indentListItem, outdentListItem } from "./listIndent";
export { createListRenumber } from "./listRenumber";
export { toggleListType } from "./listToggle";
export {
  handleRenumberList,
  handleOlToUl,
  handleUlToOl,
  cursorInOrderedList,
  cursorInUnorderedList,
} from "./listModel";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import { RENUMBER_SLASH_COMMAND, OL_TO_UL_SLASH_COMMAND, UL_TO_OL_SLASH_COMMAND } from "./listModel";

export const LISTS_SLASH_COMMANDS: SlashCommand[] = [
  RENUMBER_SLASH_COMMAND,
  OL_TO_UL_SLASH_COMMAND,
  UL_TO_OL_SLASH_COMMAND,
];
