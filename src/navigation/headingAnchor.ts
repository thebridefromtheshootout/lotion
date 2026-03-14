import { Disposable, Range, ThemeColor } from "../hostEditor/EditorTypes";
import type { DecorationOptions, TextEditorDecorationType } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

/**
 * Inline decorations showing the anchor slug next to each heading.
 *
 * When the cursor is on a heading line, shows a faded `#slug` after
 * the heading text so users can see what the anchor link will be.
 * Useful for creating internal links like `[text](#slug)`.
 */

let anchorDecorationType: TextEditorDecorationType;

function headingToSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(Regex.nonWordSpaceHyphen, "")
    .replace(Regex.whitespaceRun, "-")
    .replace(Regex.trimHyphenEdges, "");
}

function updateDecorations(): void {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;
  const decorations: DecorationOptions[] = [];

  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i);
    const match = line.text.match(Regex.headingLineWithText);
    if (!match) {
      continue;
    }

    const headingText = match[2].trim();
    const slug = headingToSlug(headingText);
    if (!slug) {
      continue;
    }

    const range = new Range(i, line.text.length, i, line.text.length);
    decorations.push({
      range,
      renderOptions: {
        after: {
          contentText: `  #${slug}`,
          color: new ThemeColor("editorCodeLens.foreground"),
          fontStyle: "italic",
        },
      },
    });
  }

  hostEditor.setDecorations(anchorDecorationType, decorations);
}

export function createHeadingAnchorDecorations(): Disposable {
  anchorDecorationType = hostEditor.createTextEditorDecorationType({});

  hostEditor.onDidChangeActiveTextEditor(() => updateDecorations());
  const disposables = [
    anchorDecorationType,
    hostEditor.onDidChangeTextDocument((e) => {
      if (hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
        updateDecorations();
      }
    }),
  ];

  // Initial update
  updateDecorations();

  return Disposable.from(...disposables);
}
