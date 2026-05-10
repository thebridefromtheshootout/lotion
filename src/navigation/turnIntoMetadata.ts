import { migrateComments } from "../editor/comments";
import { migrateProcessors } from "../editor/processor";

// ── Metadata migration ─────────────────────────────────────────────

/**
 * Move comment and processor entries from srcDoc to destDoc for any
 * markers found in the given text. Used by both the heading→subpage
 * extraction and the link→heading inlining flows.
 */
export function migrateMetadata(text: string, srcDocPath: string, destDocPath: string): void {
  migrateComments(text, srcDocPath, destDocPath);
  migrateProcessors(text, srcDocPath, destDocPath);
}
