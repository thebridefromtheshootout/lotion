// -- gif/index.ts -- barrel re-exports ---------------------------------------
// GIF feature logic is split into focused modules.

export { GIF_SLASH_COMMAND, handleGifCommand } from "./gifCommand";
export { searchGifs } from "./gifSearch";
export { downloadToFile } from "./gifDownload";
export { GIF_PROVIDER_INFO } from "./gifTypes";
export type { GifItem, GifProvider } from "./gifTypes";
