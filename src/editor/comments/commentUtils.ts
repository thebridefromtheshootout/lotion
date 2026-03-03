import { loadComments, saveComments } from "./commentModel";
import { findCommentMarkerIds, commentMarker, generateId } from "./commentCommands";

// ── Metadata migration / duplication utilities ────────────────────

/**
 * Move comment entries from one document to another for any
 * `<!--lotion-comment:ID-->` markers found in `text`.
 */
export function migrateComments(text: string, srcDocPath: string, destDocPath: string): void {
  const ids = findCommentMarkerIds(text);
  if (ids.length === 0) {
    return;
  }

  const srcComments = loadComments(srcDocPath);
  const destComments = loadComments(destDocPath);

  const movedIds = new Set(ids);
  const toMove = srcComments.filter((c) => movedIds.has(c.id));
  const remaining = srcComments.filter((c) => !movedIds.has(c.id));

  if (toMove.length === 0) {
    return;
  }

  destComments.push(...toMove);
  saveComments(destDocPath, destComments);
  saveComments(srcDocPath, remaining);
}

/**
 * Duplicate every `<!--lotion-comment:ID-->` marker in `blockText`:
 * each old ID is replaced with a fresh one and the corresponding comment
 * entry is cloned in the JSON file.  Returns the rewritten text.
 */
export function duplicateCommentMarkers(blockText: string, docPath: string): string {
  const ids = findCommentMarkerIds(blockText);
  if (ids.length === 0) {
    return blockText;
  }

  const allComments = loadComments(docPath);
  for (const oldId of ids) {
    const newId = generateId();
    blockText = blockText.replace(commentMarker(oldId), commentMarker(newId));
    const original = allComments.find((c) => c.id === oldId);
    if (original) {
      allComments.push({ ...original, id: newId, createdAt: new Date().toISOString() });
    }
  }
  saveComments(docPath, allComments);
  return blockText;
}
