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
  constructor(protected readonly webview: Webview) {
    super();
    webview.onDidReceiveMessage((message: MessageIn) => {
      this.notifyMessageIn(message);
    });
  }

  /** Send a typed message to the webview. */
  protected sendMessageOut(msg: MessageOut): Thenable<boolean> {
    return this.webview.postMessage(msg);
  }
}
