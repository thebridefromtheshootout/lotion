import { Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextEditorDecorationType } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

// ── Strikethrough completed tasks ──────────────────────────────────
//
// Applies a faded + strikethrough decoration to all `- [x]` lines
// in markdown files, making completed tasks visually distinct.

const CHECKED_RE = /^\s*[-*+] \[x\]/i;

let decoration: TextEditorDecorationType | undefined;

export function createStrikethroughDecorations(): Disposable {
  decoration = hostEditor.createTextEditorDecorationType({
    textDecoration: "line-through",
    opacity: "0.55",
    color: "#22863a",
    dark: { color: "#85e89d" },
  });

  // Apply on activation
  applyDecorations();

  hostEditor.onDidChangeActiveTextEditor(() => applyDecorations());
  const disposables: Disposable[] = [
    decoration,
    hostEditor.onDidChangeTextDocument((e) => {
      if (hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
        applyDecorations();
      }
    }),
  ];

  return Disposable.from(...disposables);
}

function applyDecorations(): void {
  if (!decoration || !hostEditor.isMarkdownEditor()) {
    if (decoration && hostEditor.isMarkdownEditor()) {
      hostEditor.setDecorations(decoration, []);
    }
    return;
  }

  const ranges: Range[] = [];
  const lineCount = hostEditor.getLineCount();

  for (let i = 0; i < lineCount; i++) {
    const lineText = hostEditor.getLineText(i);
    if (CHECKED_RE.test(lineText)) {
      const lineStart = new Position(i, 0);
      const lineEnd = new Position(i, lineText.length);
      ranges.push(new Range(lineStart, lineEnd));
    }
  }

  hostEditor.setDecorations(decoration, ranges);
}
