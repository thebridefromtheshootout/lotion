// ── Links module barrel ─────────────────────────────────────────────
export { createBacklinkCodeLensProvider } from "./backlinkCodeLens";
export { BacklinksProvider } from "./backlinks";
export { createLinkCompletionProvider } from "./linkComplete";
export { convertLinksToReference, convertLinksToInline } from "./linkConvert";
export { createLinkHoverProvider } from "./linkHover";
export { handleLinkCommand } from "./linkInsert";
export { handleOpenLinkCommand } from "./openLink";
export { searchWorkspaceLinks } from "./searchLinks";
export { createLinkValidator } from "./linkValidator";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import { LINK_SLASH_COMMAND } from "./linkInsert";
import { OPENLINK_SLASH_COMMAND } from "./openLink";

export const LINKS_SLASH_COMMANDS: SlashCommand[] = [
  LINK_SLASH_COMMAND,
  OPENLINK_SLASH_COMMAND,
];
