import { Comment } from "../comment";
import type { IExtensionPanelMessage } from "../communicator";

// ── Outgoing (extension → webview) ─────────────────────────────────

export type CommentPanelMessageOutType = "update";
export type CommentPanelMessageInType = "ready" | "resolve" | "delete" | "goToComment";

export interface IExtensionToCommentPanelMessage extends IExtensionPanelMessage<CommentPanelMessageOutType> {
  comments: Comment[];
  fileName: string;
}
// ── Incoming (webview → extension) ─────────────────────────────────

export interface ICommentPanelToExtensionMessage extends IExtensionPanelMessage<CommentPanelMessageInType> {}
export interface ICommentPanelToExtensionMessageWithId extends ICommentPanelToExtensionMessage {
  id: string;
}
