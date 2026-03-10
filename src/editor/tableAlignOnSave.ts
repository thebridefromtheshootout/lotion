import { hostEditor } from "../hostEditor/HostingEditor";
import { Disposable } from "../hostEditor/EditorTypes";
import { cursorInTable } from "./table";
import { handleAlignTable } from "./table";

// ── Auto-align tables on save ──────────────────────────────────────

/**
 * Auto-align table columns when saving a file if cursor is in a table
 */
export function createTableAlignOnSave(): Disposable {
  return hostEditor.onWillSaveTextDocument((e) => {
    const doc = e.document;
    if (doc.languageId !== "markdown") {
      return;
    }

    const pos = hostEditor.getCursorPosition();
    if (pos && cursorInTable(doc, pos)) {
      e.waitUntil(
        (async () => {
          await handleAlignTable(doc, pos);
          return [];
        })()
      );
    }
  });
}
