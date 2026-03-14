import { type TextDocument, CodeLens, Disposable } from "../../hostEditor/EditorTypes";
import { codeLens, Cmd, createStatefulCodeLensProvider } from "../../core";
import { loadComments } from "./commentModel";
import { findCommentLine } from "./commentCommands";

// ── CodeLens provider ──────────────────────────────────────────────
let refreshCommentLenses: (() => void) | undefined;
function generateCommentLenses(document: TextDocument): CodeLens[] {
  const docPath = document.uri.fsPath;
  const comments = loadComments(docPath);
  const lenses: CodeLens[] = [];

  for (const c of comments) {
    const line = findCommentLine(document, c.id);
    if (line < 0) {
      continue;
    } // marker not found — skip
    const icon = c.resolved ? "✅" : "💬";
    const authorTag = c.author ? `[${c.author}] ` : "";
    const preview = c.body.length > 40 ? c.body.slice(0, 40) + "…" : c.body;

    lenses.push(codeLens(line, `${icon} ${authorTag}${preview}`, Cmd.showCommentPanel, [docPath]));
  }

  return lenses;
}

export function createCommentCodeLensProvider(): Disposable {
  const { disposable, refresh } = createStatefulCodeLensProvider({
    generator: generateCommentLenses,
  });
  refreshCommentLenses = refresh;
  return disposable;
}
/** Trigger a CodeLens refresh for comments. */

export function fireCommentLensRefresh(): void {
  refreshCommentLenses?.();
}
