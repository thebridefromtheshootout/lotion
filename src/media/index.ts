// ── Media module barrel ─────────────────────────────────────────────
export { generateGraphLenses } from "./graph";
export { createImageDropProvider } from "./imageDrop";
export { createImagePasteProvider, isImagePasteProviderActive } from "./imagePaste";
export { createImageHoverProvider } from "./imageHover";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import { IMAGE_SLASH_COMMAND } from "./image";
import { RESOURCE_SLASH_COMMAND } from "./resource";
import { GIF_SLASH_COMMAND } from "./gif";
import { GRAPH_SLASH_COMMAND, RENDER_GRAPH_SLASH_COMMAND } from "./graph";

export const MEDIA_SLASH_COMMANDS: SlashCommand[] = [
  IMAGE_SLASH_COMMAND,
  RESOURCE_SLASH_COMMAND,
  GIF_SLASH_COMMAND,
  GRAPH_SLASH_COMMAND,
  RENDER_GRAPH_SLASH_COMMAND,
];
