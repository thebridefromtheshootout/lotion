import * as path from "node:path";
import { type WebviewPanel, ViewColumn, Uri, Position, Selection, Range, TextEditorRevealType } from "vscode";
import { ExtensionToCommentPanelCommunicator } from "../../communicators/commentPanelCommunicator";
import { Comment } from "../../contracts/comment";
import { Panel } from "../../core";
import { getExtensionUri, getWebviewShellHtml } from "../../core/webviewShell";
import { Cmd } from "../../core/commands";
import type { SlashCommand } from "../../core/slashCommands";
import type { TextDocument } from "../../hostEditor/EditorTypes";

import { hostEditor } from "../../hostEditor/HostingEditor";
import { loadComments } from "./commentModel";
import { findCommentLine, resolveComment, deleteComment } from "./commentCommands";

/** Wrapper to match SlashCommand handler signature */
async function handleShowCommentPanel(doc: TextDocument, _pos: Position): Promise<void> {
  showCommentPanel(doc.uri.fsPath);
}

export const COMMENTS_SLASH_COMMAND: SlashCommand = {
  label: "/comments",
  insertText: "",
  detail: "\ud83d\udcac Show/manage comments on this page",
  isAction: true,
  commandId: Cmd.showCommentPanel,
  kind: 2,
  handler: handleShowCommentPanel,
};

// ── Comment Pane Webview ───────────────────────────────────────────
interface CommentPanelState {
  panel: WebviewPanel;
  communicator: ExtensionToCommentPanelCommunicator;
}
const commentPanels = new Map<string, CommentPanelState>();
/** Build the update payload with resolved line numbers for each comment. */
function buildCommentPayload(docPath: string): { fileName: string; comments: Comment[] } {
  const comments = loadComments(docPath);
  const openDoc = hostEditor.getTextDocuments().find((d) => d.uri.fsPath === docPath);
  const fileName = path.basename(docPath);
  return {
    fileName,
    comments: comments.map((c) => ({
      id: c.id,
      anchorText: c.anchorText,
      body: c.body,
      createdAt: c.createdAt,
      resolved: c.resolved,
      author: c.author,
      line: openDoc ? findCommentLine(openDoc, c.id) : -1,
    })),
  };
}
export function refreshCommentPanel(docPath: string): void {
  const state = commentPanels.get(docPath);
  if (!state) {
    return;
  }
  const { fileName, comments } = buildCommentPayload(docPath);
  state.communicator.sendComments(fileName, comments);
}

export function showCommentPanel(docPath: string): void {
  const existing = commentPanels.get(docPath);
  if (existing) {
    existing.panel.reveal(ViewColumn.Beside);
    refreshCommentPanel(docPath);
    return;
  }

  const fileName = path.basename(docPath, ".md");
  const panel = hostEditor.createWebviewPanel(
    Panel.commentPane,
    `💬 Comments: ${fileName}`,
    "commentApp",
    ViewColumn.Beside,
  );

  const communicator = new ExtensionToCommentPanelCommunicator(panel.webview);
  commentPanels.set(docPath, { panel, communicator });

  panel.onDidDispose(() => {
    commentPanels.delete(docPath);
  });

  communicator.registerOnCommentPanelReady(() => {
    const { fileName, comments } = buildCommentPayload(docPath);
    communicator.sendComments(fileName, comments);
  });

  communicator.registerOnResolve(async (msg) => {
    await resolveComment(docPath, msg.id);
  });

  communicator.registerOnDelete(async (msg) => {
    await deleteComment(docPath, msg.id);
  });

  communicator.registerOnGoToComment(async (msg) => {
    const doc = await hostEditor.openTextDocument(docPath);
    await hostEditor.showTextDocument(doc, ViewColumn.One);
    const line = findCommentLine(doc, msg.id);
    if (line >= 0) {
      const pos = new Position(line, 0);
      hostEditor.setSelection(new Selection(pos, pos));
      hostEditor.revealRange(new Range(pos, pos), TextEditorRevealType.InCenter);
    }
  });
}
