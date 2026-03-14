import { Disposable, StatusBarAlignment } from "../hostEditor/EditorTypes";
import type { StatusBarItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

// ── Word count status bar item ─────────────────────────────────────
//
// Shows live word count, character count, and estimated reading time
// in the VS Code status bar for markdown files.

let statusBarItem: StatusBarItem | undefined;

export function createWordCountStatusBar(): Disposable {
  statusBarItem = hostEditor.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.tooltip = "Lotion: Word count / characters / reading time";

  // Update on activation, editor change, and document edits
  updateWordCount();

  hostEditor.onDidChangeActiveTextEditor(() => updateWordCount());
  hostEditor.onDidChangeTextEditorSelection(() => updateWordCount());
  const disposables: Disposable[] = [
    statusBarItem,
    hostEditor.onDidChangeTextDocument((e) => {
      if (hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
        updateWordCount();
      }
    }),
  ];

  return Disposable.from(...disposables);
}

function updateWordCount(): void {
  if (!statusBarItem) {
    return;
  }

  if (!hostEditor.isMarkdownEditor()) {
    statusBarItem.hide();
    return;
  }

  const text = hostEditor.getDocumentText();

  const wordCount = countWords(text);
  const charCount = text.length;
  const wpm = hostEditor.getConfiguration("lotion").get<number>("readingSpeed", 230);
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / wpm));

  // Check for selection
  const selection = hostEditor.getSelection();
  const hasSelection = selection && !selection.isEmpty;

  if (hasSelection) {
    const selectedText = hostEditor.getDocumentText(selection);
    const selWords = countWords(selectedText);
    const selChars = selectedText.length;

    statusBarItem.text = `$(book) ${selWords}/${wordCount} words`;
    statusBarItem.tooltip = [
      `Selection: ${selWords.toLocaleString()} words, ${selChars.toLocaleString()} chars`,
      `Document: ${wordCount.toLocaleString()} words, ${charCount.toLocaleString()} chars`,
      `Reading time: ~${readingTimeMin} min`,
    ].join("\n");
  } else {
    statusBarItem.text = `$(book) ${wordCount} words`;
    statusBarItem.tooltip = [
      `Words: ${wordCount.toLocaleString()}`,
      `Characters: ${charCount.toLocaleString()}`,
      `Reading time: ~${readingTimeMin} min`,
    ].join("\n");
  }

  statusBarItem.show();
}

function countWords(text: string): number {
  const cleaned = text
    .replace(Regex.frontmatterBlock, "") // frontmatter
    .replace(Regex.fencedCodeBlockGlobal, "") // code blocks
    .replace(Regex.inlineCodeSimpleGlobal, "") // inline code
    .replace(Regex.htmlTagGlobal, "") // HTML tags
    .replace(Regex.markdownImageGlobal, "") // images
    .replace(Regex.markdownLinkGlobal, (m) => {
      // links → keep text
      const textMatch = m.match(Regex.markdownLinkTextOnly);
      return textMatch ? textMatch[1] : "";
    });

  return cleaned.split(Regex.wordSplit).filter((w) => w.length > 0).length;
}
