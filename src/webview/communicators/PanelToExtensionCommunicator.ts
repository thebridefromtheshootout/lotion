import { Communicator, IExtensionPanelMessage } from "../../contracts/communicator";

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const api = acquireVsCodeApi();

export class PanelToExtensionCommunicator<
  MessageIn extends IExtensionPanelMessage,
  MessageOut extends IExtensionPanelMessage,
> extends Communicator<MessageIn, MessageOut> {
  private readonly listeners = new Map<MessageIn["type"], (msg: MessageIn) => void>();

  constructor() {
    super();
    window.addEventListener("message", (messageEvent: MessageEvent<MessageIn>) => {
      const message: MessageIn = messageEvent.data;
      const handler = this.listeners.get(message.type);
      if (handler) {
        handler(message);
      }
    });
  }

  /** Send a typed message to the webview. */
  protected sendMessageOut(msg: MessageOut): Thenable<boolean> {
    api.postMessage(msg);
    return Promise.resolve(true);
  }

  /** Register a handler for a specific incoming message type. */
  protected onMessageIn<K extends MessageIn["type"]>(
    msgType: K,
    action: (msg: Extract<MessageIn, { type: K }>) => void,
  ): void {
    this.listeners.set(msgType, action as (msg: MessageIn) => void);
  }
}
