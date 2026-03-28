import { Disposable, Range } from "../hostEditor/EditorTypes";
import type { DecorationOptions, TextEditorDecorationType } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

/**
 * Color-coded heading level decorations.
 *
 * Applies distinct foreground colours to H1–H6 lines in the editor
 * so heading hierarchy is visually obvious at a glance.
 *
 * Colours are chosen to work well in both light and dark themes by
 * using ThemeColor names where possible.
 */

const HEADING_COLORS: string[] = [
  "#d73a49", // H1 – red
  "#e36209", // H2 – orange
  "#6f42c1", // H3 – purple
  "#005cc5", // H4 – blue
  "#22863a", // H5 – green
  "#735c0f", // H6 – gold
];

const DARK_HEADING_COLORS: string[] = [
  "#f97583", // H1 – soft red
  "#ffab70", // H2 – soft orange
  "#b392f0", // H3 – soft purple
  "#79b8ff", // H4 – soft blue
  "#85e89d", // H5 – soft green
  "#ffea7f", // H6 – soft gold
];

export function createHeadingColors(): Disposable {
  const decorationTypes: TextEditorDecorationType[] = [];
  for (let i = 0; i < 6; i++) {
    decorationTypes.push(
      hostEditor.createTextEditorDecorationType({
        color: HEADING_COLORS[i],
        dark: { color: DARK_HEADING_COLORS[i] },
        fontWeight: i === 0 ? "bold" : undefined,
      }),
    );
  }

  function update(): void {
    if (!hostEditor.isMarkdownEditor()) {
      return;
    }
    const doc = hostEditor.getDocument()!;

    const buckets: DecorationOptions[][] = [[], [], [], [], [], []];
    let inFence = false;

    for (let line = 0; line < doc.lineCount; line++) {
      const lineText = doc.lineAt(line).text;

      // Skip headings inside fenced code blocks.
      if (Regex.fencedCodeDelimiter.test(lineText.trim())) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        continue;
      }

      const match = lineText.match(Regex.headingLineWithText);
      if (!match) {
        continue;
      }

      const level = match[1].length - 1; // 0-indexed
      buckets[level].push({ range: new Range(line, 0, line, lineText.length) });
    }

    for (let i = 0; i < 6; i++) {
      hostEditor.setDecorations(decorationTypes[i], buckets[i]);
    }
  }

  update();

  hostEditor.onDidChangeActiveTextEditor(() => update());
  const d2 = hostEditor.onDidChangeTextDocument((e) => {
    if (hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
      update();
    }
  });

  return Disposable.from(...decorationTypes, d2);
}
