// ── Media module barrel ─────────────────────────────────────────────
export { generateGraphLenses } from "./graph";
export { generateImageLenses } from "./imageCodeLens";
export { createImageDropProvider } from "./imageDrop";
export { createImagePasteProvider, isImagePasteProviderActive } from "./imagePaste";
export { createImageHoverProvider } from "./imageHover";

// ── Slash commands ─────────────────────────────────────────────────
import type { SlashCommand } from "../core/slashCommands";
import { IMAGE_SLASH_COMMAND } from "./image";
import { RESOURCE_SLASH_COMMAND } from "./resource";
import { GIF_SLASH_COMMAND } from "./gif";
import { GRAPH_SLASH_COMMAND, RENDER_GRAPH_SLASH_COMMAND } from "./graph";
import { IMAGE_LAYOUT_SLASH_COMMANDS } from "./imageLayout";
import { IMAGE_CAPTION_SLASH_COMMAND } from "./imageCaption";
import { IMAGE_SUGAR_SLASH_COMMANDS } from "./imageSugar";

export const MEDIA_SLASH_COMMANDS: SlashCommand[] = [
  IMAGE_SLASH_COMMAND,
  RESOURCE_SLASH_COMMAND,
  GIF_SLASH_COMMAND,
  GRAPH_SLASH_COMMAND,
  RENDER_GRAPH_SLASH_COMMAND,
  ...IMAGE_LAYOUT_SLASH_COMMANDS,
  IMAGE_CAPTION_SLASH_COMMAND,
  ...IMAGE_SUGAR_SLASH_COMMANDS,
];
