import { Disposable, Position, Range, StatusBarAlignment } from "../hostEditor/EditorTypes";
import type { StatusBarItem, TextDocument, TextEditorDecorationType } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";

// ── Focus mode (zen dimming) ───────────────────────────────────────
//
// When active, dims all lines except the current paragraph/block.
// Toggle on/off with the `lotion.toggleFocusMode` command.

let focusEnabled = false;
let dimDecoration: TextEditorDecorationType | undefined;
let glowDecoration: TextEditorDecorationType | undefined;
let selectionListener: Disposable | undefined;
let editorListener: Disposable | undefined;
let statusBarItem: StatusBarItem | undefined;

export function toggleFocusMode(): void {
  if (focusEnabled) {
    disableFocusMode();
  } else {
    enableFocusMode();
  }
}

function enableFocusMode(): void {
  focusEnabled = true;

  const opacity = hostEditor.getConfiguration("lotion").get<number>("focusModeOpacity", 0.35);
  dimDecoration = hostEditor.createTextEditorDecorationType({
    opacity: String(opacity),
  });

  // Subtle left border + background for the focused block
  glowDecoration = hostEditor.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: "0 0 0 3px",
    borderStyle: "solid",
    borderColor: "rgba(68,138,255,0.5)",
    backgroundColor: "rgba(68,138,255,0.04)",
    dark: {
      borderColor: "rgba(100,160,255,0.45)",
      backgroundColor: "rgba(100,160,255,0.06)",
    },
  });

  // Create status bar indicator
  statusBarItem = hostEditor.createStatusBarItem(StatusBarAlignment.Right, 99);
  statusBarItem.text = "$(eye) Focus";
  statusBarItem.tooltip = "Focus mode is ON — click to disable";
  statusBarItem.command = Cmd.toggleFocusMode;
  statusBarItem.show();

  // Listen for cursor moves and editor changes
  selectionListener = hostEditor.onDidChangeTextEditorSelection(() => {
    applyFocusDimming();
  });
  editorListener = hostEditor.onDidChangeActiveTextEditor(() => {
    applyFocusDimming();
  });

  // Apply immediately
  applyFocusDimming();
}

function disableFocusMode(): void {
  focusEnabled = false;

  if (dimDecoration) {
    // Clear decorations from all visible editors
    for (const editor of hostEditor.getVisibleTextEditors()) {
      editor.setDecorations(dimDecoration, []);
      if (glowDecoration) {
        editor.setDecorations(glowDecoration, []);
      }
    }
    dimDecoration.dispose();
    dimDecoration = undefined;
  }
  if (glowDecoration) {
    glowDecoration.dispose();
    glowDecoration = undefined;
  }

  selectionListener?.dispose();
  selectionListener = undefined;
  editorListener?.dispose();
  editorListener = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
}

function applyFocusDimming(): void {
  if (!dimDecoration || !focusEnabled) {
    return;
  }
  if (!hostEditor.isMarkdownEditor()) {
    hostEditor.setDecorations(dimDecoration, []);
    if (glowDecoration) {
      hostEditor.setDecorations(glowDecoration, []);
    }
    return;
  }

  const doc = hostEditor.getDocument()!;
  const cursorLine = hostEditor.getCursorPosition()!.line;
  const { start, end } = getBlockBounds(doc, cursorLine);

  // Dim everything except the focused block
  const dimRanges: Range[] = [];

  if (start > 0) {
    dimRanges.push(new Range(new Position(0, 0), new Position(start - 1, doc.lineAt(start - 1).text.length)));
  }

  if (end < doc.lineCount - 1) {
    const lastLine = doc.lineCount - 1;
    dimRanges.push(new Range(new Position(end + 1, 0), new Position(lastLine, doc.lineAt(lastLine).text.length)));
  }

  hostEditor.setDecorations(dimDecoration, dimRanges);

  // Highlight the focused block with a glow border
  if (glowDecoration) {
    const glowRanges: Range[] = [];
    for (let i = start; i <= end; i++) {
      glowRanges.push(new Range(i, 0, i, doc.lineAt(i).text.length));
    }
    hostEditor.setDecorations(glowDecoration, glowRanges);
  }

  hostEditor.setDecorations(dimDecoration, dimRanges);
}

/**
 * Get the bounds of the "block" containing the given line.
 * A block is a contiguous group of non-empty lines, or a fenced code
 * block, or a table, or a list, etc.
 */
function getBlockBounds(document: TextDocument, line: number): { start: number; end: number } {
  const lineCount = document.lineCount;

  // Check if we're in a fenced code block
  const fenced = getFencedBlockBounds(document, line);
  if (fenced) {
    return fenced;
  }

  // Otherwise, use paragraph detection (contiguous non-empty lines)
  let start = line;
  while (start > 0 && document.lineAt(start - 1).text.trim() !== "") {
    start--;
  }

  let end = line;
  while (end < lineCount - 1 && document.lineAt(end + 1).text.trim() !== "") {
    end++;
  }

  return { start, end };
}

function getFencedBlockBounds(document: TextDocument, line: number): { start: number; end: number } | undefined {
  // Scan upward for opening fence
  let fenceStart = -1;
  for (let i = line; i >= 0; i--) {
    if (/^```/.test(document.lineAt(i).text.trim())) {
      fenceStart = i;
      break;
    }
  }
  if (fenceStart < 0) {
    return undefined;
  }

  // Check this is actually an opening fence (count fences above it)
  let fenceCount = 0;
  for (let i = 0; i < fenceStart; i++) {
    if (/^```/.test(document.lineAt(i).text.trim())) {
      fenceCount++;
    }
  }

  // If even number of fences before this one, it's an opener
  if (fenceCount % 2 !== 0) {
    // It's a closer; the opener is above — search up more
    return undefined;
  }

  // Find closing fence
  let fenceEnd = -1;
  for (let i = fenceStart + 1; i < document.lineCount; i++) {
    if (/^```\s*$/.test(document.lineAt(i).text.trim())) {
      fenceEnd = i;
      break;
    }
  }

  if (fenceEnd < 0) {
    return undefined;
  }

  // Check if the cursor line is within [fenceStart, fenceEnd]
  if (line >= fenceStart && line <= fenceEnd) {
    return { start: fenceStart, end: fenceEnd };
  }

  return undefined;
}
