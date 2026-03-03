import { ConfigurationTarget, WorkspaceEdit } from "../../hostEditor/EditorTypes";
import type { TextDocument } from "../../hostEditor/EditorTypes";
import { hostEditor } from "../../hostEditor/HostingEditor";
import * as fs from "fs";
import { Comment } from "../../contracts/comment";
import { loadComments, removeMarkerFromDocument, saveComments, saveNewComment } from "./commentModel";
import { refreshCommentPanel } from "./commentPanel";
import { fireCommentLensRefresh } from "./commentCodeLens";

// ── Types ──────────────────────────────────────────────────────────

// ── Marker helpers ─────────────────────────────────────────────────

/** Regex to match a comment marker in the document */
export const COMMENT_MARKER_RE = /<!--lotion-comment:([a-z0-9]+)-->/;
const COMMENT_MARKER_RE_G = /<!--lotion-comment:([a-z0-9]+)-->/g;

/** Build the HTML-comment marker string for a given comment id */
export function commentMarker(id: string): string {
  return `<!--lotion-comment:${id}-->`;
}

/**
 * Scan a document (or arbitrary text) for all comment marker ids.
 */
export function findCommentMarkerIds(text: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(COMMENT_MARKER_RE_G.source, "g");
  while ((m = re.exec(text)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

/**
 * Find the 0-based line number of a comment marker in a document.
 * Returns -1 if not found.
 */
export function findCommentLine(document: TextDocument, commentId: string): number {
  const needle = `<!--lotion-comment:${commentId}-->`;
  for (let i = 0; i < document.lineCount; i++) {
    if (document.lineAt(i).text.includes(needle)) {
      return i;
    }
  }
  return -1;
}

// ── Username cache ─────────────────────────────────────────────────

let cachedUsername: string | undefined;

async function getUsername(): Promise<string | undefined> {
  if (cachedUsername) {
    return cachedUsername;
  }
  // Try workspace setting
  const cfg = hostEditor.getConfiguration("lotion");
  const stored = cfg.get<string>("commentUsername");
  if (stored) {
    cachedUsername = stored;
    return stored;
  }
  // Ask the user
  const name = await hostEditor.showInputBox({
    prompt: "Enter your name for comments (saved for this workspace)",
    placeHolder: "e.g. Alice",
    validateInput: (v) => (!v || v.trim().length === 0 ? "Name is required" : undefined),
  });
  if (!name) {
    return undefined;
  }
  cachedUsername = name.trim();
  await cfg.update("commentUsername", cachedUsername, ConfigurationTarget.Workspace);
  // VS Code leaves settings.json dirty after update — flush it to disk
  const settingsDoc = hostEditor
    .getTextDocuments()
    .find((d) => d.uri.fsPath.endsWith(".vscode/settings.json") || d.uri.fsPath.endsWith(".vscode\\settings.json"));
  if (settingsDoc) {
    await settingsDoc.save();
  }
  return cachedUsername;
}

// ── Storage helpers (see commentModel.ts) ──────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Add Comment command ────────────────────────────────────────────

/**
 * "Lotion: Add Comment" — invoked from Ctrl+Shift+P.
 * Uses the current selection in the active editor.
 */
export async function addComment(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    hostEditor.showWarning("Open a markdown file to add a comment.");
    return;
  }
  const selection = hostEditor.getSelection()!;
  if (selection.isEmpty) {
    hostEditor.showWarning("Select some text first, then add a comment.");
    return;
  }

  const selectedText = hostEditor.getDocumentText(selection);
  const body = await hostEditor.showInputBox({
    prompt: "Enter your comment",
    placeHolder: "Comment on: " + selectedText.slice(0, 50) + (selectedText.length > 50 ? "…" : ""),
  });
  if (!body) {
    return;
  }

  const author = await getUsername();
  if (!author) {
    return;
  }

  const id = generateId();
  const comment: Comment = {
    id,
    anchorText: selectedText,
    body,
    createdAt: new Date().toISOString(),
    author,
    line: selection.start.line,
  };
  const docPath = hostEditor.getDocumentUri()!.fsPath;
  await saveNewComment(comment, selection, docPath);
  fireCommentLensRefresh();
  refreshCommentPanel(docPath);
}

// ── Resolve / Delete Comment commands ──────────────────────────────

export async function resolveComment(docPath: string, commentId: string): Promise<void> {
  const comments = loadComments(docPath);
  const c = comments.find((x) => x.id === commentId);
  if (c) {
    c.resolved = !c.resolved;
    saveComments(docPath, comments);
    fireCommentLensRefresh();
    refreshCommentPanel(docPath);
  }
}

export async function deleteComment(docPath: string, commentId: string): Promise<void> {
  const answer = await hostEditor.showWarningModal("Delete this comment?", ["Delete"]);
  if (answer !== "Delete") {
    return;
  }

  let comments = loadComments(docPath);
  comments = comments.filter((x) => x.id !== commentId);
  saveComments(docPath, comments);

  // Remove the marker from the document
  await removeMarkerFromDocument(docPath, commentId);

  hostEditor.showInformation("Comment deleted.");
  fireCommentLensRefresh();
  refreshCommentPanel(docPath);
}
