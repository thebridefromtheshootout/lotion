import { Webview } from "../hostEditor/EditorTypes";
import { Communicator, IExtensionPanelMessage } from "../contracts/communicator";

/**
 * Generic, typed wrapper around `Webview.postMessage`.
 * Subclasses add domain-specific convenience methods.
 */
export class ExtensionToPanelCommunicator<
  MessageIn extends IExtensionPanelMessage,
  MessageOut extends IExtensionPanelMessage,
> extends Communicator<MessageIn, MessageOut> {
  private readonly listeners = new Map<MessageIn["type"], (msg: MessageIn) => void>();

  constructor(protected readonly webview: Webview) {
    super();
    webview.onDidReceiveMessage((message: MessageIn) => {
      const handler = this.listeners.get(message.type);
      if (handler) {
        handler(message);
      }
    });
  }

  /** Send a typed message to the webview. */
  protected sendMessageOut(msg: MessageOut): Thenable<boolean> {
    return this.webview.postMessage(msg);
  }

  /** Register a handler for a specific incoming message type. */
  protected onMessageIn<K extends MessageIn["type"]>(
    msgType: K,
    action: (msg: Extract<MessageIn, { type: K }>) => void,
  ): void {
    this.listeners.set(msgType, action as (msg: MessageIn) => void);
  }
}
