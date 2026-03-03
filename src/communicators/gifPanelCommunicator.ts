import { ExtensionToPanelCommunicator } from "./extensionToPanelCommunicator";
import type {
  IGifPanelToExtensionMessage,
  IExtensionToGifPanelMessage,
  IGifPreviewPayload,
} from "../contracts/messages/gifPanelMessages";

// ── Communicator ───────────────────────────────────────────────────

export class ExtensionToGifPanelCommunicator extends ExtensionToPanelCommunicator<
  IGifPanelToExtensionMessage,
  IExtensionToGifPanelMessage
> {
  sendPreview(payload: IGifPreviewPayload): Thenable<boolean> {
    return this.sendMessageOut({ type: "preview", ...payload });
  }
}
