// ── Navigation module barrel ────────────────────────────────────────
export { createBreadcrumbStatusBar } from "./breadcrumb";
export { handleExtractToSubpage } from "./extractSubpage";
export { createHeadingAnchorDecorations } from "./headingAnchor";
export { jumpToNextHeading, jumpToPrevHeading, jumpToHeadingPicker } from "./headingNav";
export { findOrphanPages } from "./orphanPages";
export { handlePageCommand } from "./page";
export { quickSwitchPage } from "./quickSwitch";
export { createRecentPagesTracker, showRecentPages } from "./recentPages";
export { renamePage } from "./renamePage";
export { movePage } from "./movePage";
// export { showTagIndex } from "./tagIndex"; // disabled
export { handleTurnInto } from "./turnInto";
// export { wikiSearch } from "./wikiSearch"; // disabled

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import { PAGE_SLASH_COMMAND } from "./page";
import { TURNINTO_SLASH_COMMAND } from "./turnInto";
import { RENAME_PAGE_SLASH_COMMAND } from "./renamePage";
import { MOVE_PAGE_SLASH_COMMAND } from "./movePage";

export const NAVIGATION_SLASH_COMMANDS: SlashCommand[] = [
  PAGE_SLASH_COMMAND,
  RENAME_PAGE_SLASH_COMMAND,
  MOVE_PAGE_SLASH_COMMAND,
  TURNINTO_SLASH_COMMAND,
];
