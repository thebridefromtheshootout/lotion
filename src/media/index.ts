// ── Media module barrel ─────────────────────────────────────────────
export {
  generateGraphLenses,
 } from "./graph";
export { createImageDropProvider } from "./imageDrop";
export { createImageHoverProvider } from "./imageHover";
// export { findUnusedImages } from "./unusedImages"; // disabled

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import { IMAGE_SLASH_COMMAND } from "./image";
import { GIF_SLASH_COMMAND } from "./gif";
// import { EXPORT_SLASH_COMMAND } from "./pdfExport"; // disabled
// import { CAROUSEL_SLASH_COMMAND } from "./carousel";  // disabled

export const MEDIA_SLASH_COMMANDS: SlashCommand[] = [
  IMAGE_SLASH_COMMAND,
  GIF_SLASH_COMMAND,
  // EXPORT_SLASH_COMMAND, // disabled
];