import { hostEditor } from "../hostEditor/HostingEditor";
import { Disposable, TextEdit } from "../hostEditor/EditorTypes";
import { collectOrderedList, renumberEdits, toTextEdits } from "./listModel";
import { Regex } from "../core/regex";

/**
 * Automatically re-number ordered (1. 2. 3. …) lists on save.
 *
 * Uses the shared list model to abstract each list into a node sequence,
 * then renumbers the entire sequence starting from 1.
 */

const OL_RE = Regex.orderedListDotOnly;

export function createListRenumber(): Disposable {
  return hostEditor.onWillSaveTextDocument((e) => {
    const doc = e.document;
    if (doc.languageId !== "markdown") {
      return;
    }
    if (!hostEditor.getConfiguration("lotion").get<boolean>("autoRenumberLists", true)) {
      return;
    }

    const allEdits: TextEdit[] = [];
    const visited = new Set<number>();
    let i = 0;

    while (i < doc.lineCount) {
      if (visited.has(i)) {
        i++;
        continue;
      }

      const line = doc.lineAt(i);
      const m = OL_RE.exec(line.text);
      if (!m) {
        i++;
        continue;
      }

      // Collect the full list starting from this line
      const items = collectOrderedList(doc, i);
      if (items.length === 0) {
        i++;
        continue;
      }

      // Mark all item lines as visited so we don't process them again
      for (const node of items) {
        visited.add(node.line);
      }

      // Renumber the entire list from 1
      const edits = renumberEdits(doc, items, 0, 1);
      allEdits.push(...toTextEdits(edits));

      // Jump past the last item in this list
      i = items[items.length - 1].line + 1;
    }

    if (allEdits.length > 0) {
      e.waitUntil(Promise.resolve(allEdits));
    }
  });
}
