// ── Webview-side communicator base ─────────────────────────────────
//
// Mirror image of `src/communicators/extensionToPanelCommunicator.ts` on the
// extension-host side. Each named webview (Db panel, Comment panel, Date
// panel, Gif panel) has a pair of communicators:
//
//   src/webview/communicators/<Name>ToExtensionCommunicator.ts        (this side)
//   src/communicators/<lowercased>Communicator.ts                     (host side)
//
// Both subclass a base `Communicator<MessageIn, MessageOut>` from
// `src/contracts/communicator.ts`. The contract types live in
// `src/contracts/messages/<name>Messages.ts` and are imported by both
// sides, so adding a new message type is a single contract edit + a
// register/send method on each communicator.
//
// PanelToExtensionCommunicator wires the webview's `window` message
// listener to `notifyMessageIn`, and exposes `sendMessageOut` that goes
// out via the VS Code webview `postMessage` API.

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
