import { Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument, TextDocumentContentChangeEvent } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

/**
 * Smart typographic quotes on type.
 *
 * Replaces straight quotes with curly quotes:
 *   " → " or "  (depending on context)
 *   ' → ' or '  (depending on context)
 *   -- → —  (em dash)
 *   ... → …  (ellipsis)
 *
 * Only active in markdown files. Skips code spans & code blocks.
 */

export function createSmartTypography(): Disposable {
  return hostEditor.onDidChangeTextDocument((e) => {
    if (e.document.languageId !== "markdown") {
      return;
    }
    if (!hostEditor.getConfiguration("lotion").get<boolean>("smartTypography", true)) {
      return;
    }
    if (!hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
      return;
    }

    const doc = e.document;

    for (const change of e.contentChanges) {
      if (change.text === '"' || change.text === "'") {
        handleQuote(doc, change);
      } else if (change.text === "-") {
        handleDash(doc, change);
      } else if (change.text === ".") {
        handleEllipsis(doc, change);
      }
    }
  });
}

function isInsideCode(doc: TextDocument, pos: Position): boolean {
  const line = doc.lineAt(pos.line).text;
  // inside fenced code block?
  let fenced = false;
  for (let i = 0; i < pos.line; i++) {
    if (/^```/.test(doc.lineAt(i).text)) {
      fenced = !fenced;
    }
  }
  if (fenced) {
    return true;
  }
  // inside inline code?
  const before = line.substring(0, pos.character);
  const backticks = (before.match(/`/g) || []).length;
  return backticks % 2 === 1;
}

function handleQuote(doc: TextDocument, change: TextDocumentContentChangeEvent): void {
  const pos = new Position(
    change.range.start.line,
    change.range.start.character + 1, // after the just-typed quote
  );

  if (isInsideCode(doc, change.range.start)) {
    return;
  }

  const charBefore = pos.character > 1 ? doc.lineAt(pos.line).text[pos.character - 2] : undefined;

  const isOpening = !charBefore || /\s|\(|\[|{/.test(charBefore);

  let replacement: string;
  if (change.text === '"') {
    replacement = isOpening ? "\u201C" : "\u201D"; // " "
  } else {
    replacement = isOpening ? "\u2018" : "\u2019"; // ' '
  }

  const replaceRange = new Range(new Position(pos.line, pos.character - 1), pos);

  // Use setTimeout so we don't interfere with the current change event
  setTimeout(() => {
    hostEditor.replaceRange(replaceRange, replacement, { undoStopBefore: false, undoStopAfter: false });
  }, 0);
}

function handleDash(doc: TextDocument, change: TextDocumentContentChangeEvent): void {
  const pos = new Position(change.range.start.line, change.range.start.character + 1);

  if (isInsideCode(doc, change.range.start)) {
    return;
  }

  const line = doc.lineAt(pos.line).text;
  // Check for "---" (3 dashes) → don't replace (hr / frontmatter)
  if (pos.character >= 3 && line.substring(pos.character - 3, pos.character) === "---") {
    return;
  }
  // Check for "--" → replace with em dash "—"
  if (pos.character >= 2 && line.substring(pos.character - 2, pos.character) === "--") {
    const replaceRange = new Range(new Position(pos.line, pos.character - 2), pos);
    setTimeout(() => {
      hostEditor.replaceRange(replaceRange, "\u2014", { undoStopBefore: false, undoStopAfter: false });
    }, 0);
  }
}

function handleEllipsis(doc: TextDocument, change: TextDocumentContentChangeEvent): void {
  const pos = new Position(change.range.start.line, change.range.start.character + 1);

  if (isInsideCode(doc, change.range.start)) {
    return;
  }

  const line = doc.lineAt(pos.line).text;
  if (pos.character >= 3 && line.substring(pos.character - 3, pos.character) === "...") {
    const replaceRange = new Range(new Position(pos.line, pos.character - 3), pos);
    setTimeout(() => {
      hostEditor.replaceRange(replaceRange, "\u2026", { undoStopBefore: false, undoStopAfter: false });
    }, 0);
  }
}
