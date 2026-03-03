// ── Blocks module barrel ────────────────────────────────────────────
export { swapBlockUp, swapBlockDown } from "./blockSwap";
export { handleDuplicateBlock } from "./duplicateBlock";
export {
  handleLockCommand,
  handleUnlockCommand,
  handleSecretboxCommand,
  createSecretboxGuard,
  createSecretboxSaveGuard,
  cursorInSecretbox,
} from "./lockBlock";
export { handleMoveCommand } from "./moveBlock";
export { selectBlock } from "./selectBlock";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import { SECRETBOX_SLASH_COMMAND, LOCK_SLASH_COMMAND, UNLOCK_SLASH_COMMAND } from "./lockBlock";
// import { MOVE_SLASH_COMMAND } from "./moveBlock";  // disabled

export const BLOCKS_SLASH_COMMANDS: SlashCommand[] = [
  SECRETBOX_SLASH_COMMAND,
  LOCK_SLASH_COMMAND,
  UNLOCK_SLASH_COMMAND,
  // MOVE_SLASH_COMMAND,  // disabled
];
