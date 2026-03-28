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
  constructor() {
    super();
    window.addEventListener("message", (messageEvent: MessageEvent<MessageIn>) => {
      const message: MessageIn = messageEvent.data;
      this.notifyMessageIn(message);
    });
  }

  /** Send a typed message to the webview. */
  protected sendMessageOut(msg: MessageOut): Thenable<boolean> {
    api.postMessage(msg);
    return Promise.resolve(true);
  }
}
