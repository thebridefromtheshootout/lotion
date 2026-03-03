import { Comment } from "../contracts/comment";
import { ExtensionToPanelCommunicator } from "./extensionToPanelCommunicator";
import {
  ICommentPanelToExtensionMessage,
  IExtensionToCommentPanelMessage,
  ICommentPanelToExtensionMessageWithId,
} from "../contracts/messages/commentPanelMessages";

// ── Communicator ───────────────────────────────────────────────────

export class ExtensionToCommentPanelCommunicator extends ExtensionToPanelCommunicator<
  ICommentPanelToExtensionMessage,
  IExtensionToCommentPanelMessage
> {
  /** Send the full comment list to the webview. */
  sendComments(fileName: string, comments: Comment[]): Thenable<boolean> {
    return this.sendMessageOut({ type: "update", fileName, comments });
  }
  registerOnCommentPanelReady(action: (msg: ICommentPanelToExtensionMessage) => void) {
    this.onMessageIn("ready", action);
  }
  registerOnResolve(action: (msg: ICommentPanelToExtensionMessageWithId) => void) {
    this.onMessageIn("resolve", action);
  }
  registerOnDelete(action: (msg: ICommentPanelToExtensionMessageWithId) => void) {
    this.onMessageIn("delete", action);
  }
  registerOnGoToComment(action: (msg: ICommentPanelToExtensionMessageWithId) => void) {
    this.onMessageIn("goToComment", action);
  }
}
