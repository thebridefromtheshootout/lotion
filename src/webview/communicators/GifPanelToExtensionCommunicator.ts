import type {
  IExtensionToGifPanelMessage,
  IExtensionToGifPanelPreviewMessage,
  IGifPanelToExtensionMessage,
} from "../../contracts/messages/gifPanelMessages";
import { PanelToExtensionCommunicator } from "./PanelToExtensionCommunicator";

// MessageIn = what the extension sends TO us
// MessageOut = what we send TO the extension

export class GifPanelToExtensionCommunicator extends PanelToExtensionCommunicator<
  IExtensionToGifPanelMessage,
  IGifPanelToExtensionMessage
> {
  // ── Incoming (extension → panel) ───────────────────────────────

  registerOnPreview(action: (msg: IExtensionToGifPanelPreviewMessage) => void): void {
    this.onMessageIn("preview", action);
  }
}
