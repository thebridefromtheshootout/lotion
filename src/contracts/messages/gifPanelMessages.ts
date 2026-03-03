import type { IExtensionPanelMessage } from "../communicator";

// ── Outgoing (extension → webview) ─────────────────────────────────

export interface IGifPreviewPayload {
  url: string;
  title: string;
}

export interface IExtensionToGifPanelPreviewMessage extends IExtensionPanelMessage<"preview">, IGifPreviewPayload {}

export type IExtensionToGifPanelMessage = IExtensionToGifPanelPreviewMessage;

// ── Incoming (webview → extension) ─────────────────────────────────
// The gif preview panel does not send messages back to the extension.

export interface IGifPanelNoOpMessage extends IExtensionPanelMessage<"__noop"> {}
export type IGifPanelToExtensionMessage = IGifPanelNoOpMessage;
