import type { Webview } from "../hostEditor/EditorTypes";

// ── Base message contract ──────────────────────────────────────────

/**
 * Base interface for every webview panel message.
 * Every message carries a string `type` discriminant.
 */
export interface IExtensionPanelMessage<T extends string = string> {
  type: T;
}

// ── Base communicator ──────────────────────────────────────────────
export abstract class Communicator<
  MessageIn extends IExtensionPanelMessage,
  MessageOut extends IExtensionPanelMessage,
> {
  /** Send a typed message to the webview. */
  protected abstract sendMessageOut(msg: MessageOut): Thenable<boolean>;

  /** Register a handler for a specific incoming message type. */
  protected abstract onMessageIn<K extends MessageIn["type"]>(
    msgType: K,
    action: (msg: Extract<MessageIn, { type: K }>) => void,
  ): void;
}
