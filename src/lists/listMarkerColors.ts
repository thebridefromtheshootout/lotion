import { Disposable, Range } from "../hostEditor/EditorTypes";
import type { DecorationOptions, TextEditorDecorationType } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { getBlockIndex } from "../core/blockIndex";

// Color-coded list-marker decorations by indent depth.
//
// VS Code's default markdown grammar loses marker highlighting when a
// list item has a "lazy continuation" line — an unindented paragraph
// line that, per CommonMark, still belongs to the previous list item.
// Once highlighting trips, every following marker (siblings and
// children) renders with the wrong style.
//
// We bypass the grammar by decorating markers ourselves, choosing
// depth purely from leading-whitespace width so the result is stable
// regardless of what the grammar thinks. Two columns of indent → next
// depth, matching the project's standard list indentation.

const LIGHT_MARKER_COLORS: string[] = [
  "#0366d6", // depth 0 – blue
  "#22863a", // depth 1 – green
  "#b08800", // depth 2 – gold
  "#6f42c1", // depth 3 – purple
  "#d73a49", // depth 4 – red
  "#e36209", // depth 5 – orange
];

const DARK_MARKER_COLORS: string[] = [
  "#79b8ff",
  "#85e89d",
  "#ffea7f",
  "#b392f0",
  "#f97583",
  "#ffab70",
];

const DEPTH_COUNT = LIGHT_MARKER_COLORS.length;
const INDENT_STEP = 2;

export function createListMarkerColors(): Disposable {
  const decorationTypes: TextEditorDecorationType[] = [];
  for (let i = 0; i < DEPTH_COUNT; i++) {
    decorationTypes.push(
      hostEditor.createTextEditorDecorationType({
        color: LIGHT_MARKER_COLORS[i],
        fontWeight: "bold",
        dark: { color: DARK_MARKER_COLORS[i] },
      }),
    );
  }

  function update(): void {
    if (!hostEditor.isMarkdownEditor()) {
      return;
    }
    const doc = hostEditor.getDocument()!;
    const idx = getBlockIndex(doc);

    const buckets: DecorationOptions[][] = Array.from({ length: DEPTH_COUNT }, () => []);

    for (let line = 0; line < doc.lineCount; line++) {
      if (idx.isInCodeFence(line)) {
        continue;
      }
      const text = doc.lineAt(line).text;
      const m = text.match(Regex.anyListPrefix);
      if (!m) {
        continue;
      }
      const indentLen = m[1].length;
      const markerLen = m[2].length;
      const depth = Math.min(Math.floor(indentLen / INDENT_STEP), DEPTH_COUNT - 1);
      buckets[depth].push({
        range: new Range(line, indentLen, line, indentLen + markerLen),
      });
    }

    for (let i = 0; i < DEPTH_COUNT; i++) {
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
