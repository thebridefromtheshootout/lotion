import * as path from "path";
import * as fs from "fs";
import { Comment } from "../../contracts/comment";
import { hostEditor } from "../../hostEditor/HostingEditor";
import { commentMarker, findCommentLine } from "./commentCommands";
import { Selection, WorkspaceEdit } from "../../hostEditor/EditorTypes";
import { loadJsonStore, saveJsonStore } from "../../core/jsonStore";

// ── Storage helpers ────────────────────────────────────────────────
export async function saveNewComment(comment: Comment, selection: Selection, docPath: string) {
  const comments = loadComments(docPath);
  comments.push(comment);
  saveComments(docPath, comments);
  const id = comment.id;
  // Insert the GUID marker at the end of the anchor line
  const anchorLine = selection.start.line;
  const lineEnd = hostEditor.getLine(anchorLine).range.end;
  await hostEditor.insertAt(lineEnd, ` ${commentMarker(id)}`);
  await hostEditor.saveActiveDocument();

  hostEditor.showInformation(`Comment added on line ${anchorLine + 1}.`);
  return;
}

function getCommentsFilePath(docPath: string): string {
  const dir = path.dirname(docPath);
  const rsrc = path.join(dir, ".rsrc");
  return path.join(rsrc, "comments.json");
}

export function loadComments(docPath: string): Comment[] {
  return loadJsonStore<Comment[]>(getCommentsFilePath(docPath), []);
}

export function saveComments(docPath: string, comments: Comment[]): void {
  saveJsonStore(getCommentsFilePath(docPath), comments);
}

/**
 * Remove a <!--lotion-comment:ID--> marker from the on-disk file and any
 * matching open editor.
 */
export async function removeMarkerFromDocument(docPath: string, commentId: string): Promise<void> {
  const marker = commentMarker(commentId);
  // Try open editors first
  const openDocs = hostEditor.getTextDocuments().filter((d) => d.uri.fsPath === docPath);
  if (openDocs.length > 0) {
    const doc = openDocs[0];
    const line = findCommentLine(doc, commentId);
    if (line >= 0) {
      const lineText = doc.lineAt(line).text;
      const cleaned = lineText.replace(` ${marker}`, "").replace(marker, "");
      const edit = new WorkspaceEdit();
      edit.replace(doc.uri, doc.lineAt(line).range, cleaned);
      await hostEditor.applyWorkspaceEdit(edit);
      await doc.save();
    }
  } else {
    // Edit on disk
    if (fs.existsSync(docPath)) {
      let content = fs.readFileSync(docPath, "utf-8");
      content = content.replace(` ${marker}`, "").replace(marker, "");
      fs.writeFileSync(docPath, content, "utf-8");
    }
  }
}
