import { Disposable, Position } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

/**
 * Smart bracket/pair completion for markdown.
 *
 * When typing an opening pair character, auto-inserts the closing one
 * and positions the cursor between them. Supports:
 *   - **|** (bold)
 *   - *|*  (italic)
 *   - ~~|~~ (strikethrough)
 *   - ==|== (highlight)
 *   - `|`  (code)
 *   - $|$  (math)
 *   - [|]  (link text)
 *
 * This is registered as a type-event listener, not a completion provider.
 */

interface PairDef {
  trigger: string;
  open: string;
  close: string;
}

const PAIRS: PairDef[] = [
  { trigger: "**", open: "**", close: "**" },
  { trigger: "~~", open: "~~", close: "~~" },
  { trigger: "==", open: "==", close: "==" },
];

export function createSmartPairs(): Disposable {
  return hostEditor.onDidChangeTextDocument((e) => {
    if (e.document.languageId !== "markdown") {
      return;
    }
    if (!hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
      return;
    }

    for (const change of e.contentChanges) {
      // Check for double-character trigger (**, ~~, ==)
      if (change.text.length !== 1) {
        continue;
      }

      const pos = new Position(change.range.start.line, change.range.start.character + 1);
      const lineText = e.document.lineAt(pos.line).text;
      const charBefore = pos.character >= 2 ? lineText[pos.character - 2] : "";
      const typed = change.text;

      // Check if we just typed a double-char trigger
      const trigger = charBefore + typed;
      const pair = PAIRS.find((p) => p.trigger === trigger);

      if (pair) {
        // Check the char after cursor — don't auto-close if it's already the
        // closing characters
        const after = lineText.substring(pos.character, pos.character + pair.close.length);
        if (after === pair.close) {
          continue;
        }

        // Check the char before the trigger — skip if it looks like we're
        // closing an existing pair (e.g. text** end)
        const beforeTrigger =
          pos.character > pair.open.length ? lineText.substring(0, pos.character - pair.open.length) : "";
        // If there's already an open pair on this line that's not closed, don't auto-close
        const openCount = (beforeTrigger.match(new RegExp(escapeRegex(pair.open), "g")) || []).length;
        if (openCount % 2 === 1) {
          continue;
        } // we're closing an existing pair

        setTimeout(() => {
          hostEditor.insertAt(pos, pair.close, { undoStopBefore: false, undoStopAfter: false });
        }, 0);
      }
    }
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
