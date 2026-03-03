import type {
  ICommentPanelToExtensionMessage,
  ICommentPanelToExtensionMessageWithId,
  IExtensionToCommentPanelMessage,
} from "../../communicators/commentPanelCommunicator";
import { Comment } from "../../contracts/comment";
import { PanelToExtensionCommunicator } from "./PanelToExtensionCommunicator";

// MessageIn = what the extension sends TO us (ICommentPanelMessageOut)
// MessageOut = what we send TO the extension  (ICommentPanelMessageIn)

export class CommentPanelToExtensionCommunicator extends PanelToExtensionCommunicator<
  IExtensionToCommentPanelMessage,
  ICommentPanelToExtensionMessage
> {
  // ── Outgoing (panel → extension) ───────────────────────────────

  /** Tell the extension we're ready to receive data. */
  sendReady(): void {
    this.sendMessageOut({ type: "ready" });
  }

  /** Ask the extension to resolve/unresolve a comment. */
  sendResolve(id: string): void {
    this.sendMessageOut({ type: "resolve", id } as ICommentPanelToExtensionMessageWithId);
  }

  /** Ask the extension to delete a comment. */
  sendDelete(id: string): void {
    this.sendMessageOut({ type: "delete", id } as ICommentPanelToExtensionMessageWithId);
  }

  /** Ask the extension to navigate to a comment's anchor. */
  sendGoToComment(id: string): void {
    this.sendMessageOut({ type: "goToComment", id } as ICommentPanelToExtensionMessageWithId);
  }

  // ── Incoming (extension → panel) ───────────────────────────────

  /** Register a handler for when the extension sends an updated comment list. */
  registerOnUpdate(action: (fileName: string, comments: Comment[]) => void): void {
    this.onMessageIn("update", (msg) => {
      action(msg.fileName, msg.comments);
    });
  }
}
