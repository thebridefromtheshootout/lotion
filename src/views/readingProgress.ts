import { Disposable, StatusBarAlignment } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

/**
 * Reading progress indicator.
 *
 * Shows the current scroll/cursor position as a percentage through the
 * document in the status bar:  "↕ 42%"
 *
 * Only shown for markdown files.
 */
export function createReadingProgress(): Disposable {
  const bar = hostEditor.createStatusBarItem(StatusBarAlignment.Right, 90);
  bar.tooltip = "Reading progress";

  function update(): void {
    if (!hostEditor.isMarkdownEditor()) {
      bar.hide();
      return;
    }

    const totalLines = hostEditor.getLineCount();
    if (totalLines <= 1) {
      bar.text = "$(arrow-both) 0%";
      bar.show();
      return;
    }

    // Use the last visible line to represent scroll position
    const visibleRanges = hostEditor.getVisibleRanges();
    const lastVisible = visibleRanges[0] ? visibleRanges[0].end.line : 0;
    const pct = Math.round((lastVisible / (totalLines - 1)) * 100);
    bar.text = `$(arrow-both) ${Math.min(pct, 100)}%`;
    bar.show();
  }

  update();

  hostEditor.onDidChangeActiveTextEditor(() => update());
  hostEditor.onDidChangeTextEditorVisibleRanges(() => update());
  const d3 = hostEditor.onDidChangeTextDocument((e) => {
    if (hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
      update();
    }
  });

  return Disposable.from(bar, d3);
}
