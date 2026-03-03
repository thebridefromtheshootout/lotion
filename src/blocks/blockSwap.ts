
import { Position, Range, Selection } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

/**
 * Move the current block (paragraph / list-item / heading section) up or down.
 * Uses blank-line boundaries to detect block extent.
 */

function getBlockRange(doc: TextDocument, line: number): [number, number] {
  let start = line;
  let end = line;
  // expand up to blank line or start of doc
  while (start > 0 && doc.lineAt(start - 1).text.trim() !== "") {
    start--;
  }
  // expand down
  while (end < doc.lineCount - 1 && doc.lineAt(end + 1).text.trim() !== "") {
    end++;
  }
  return [start, end];
}

async function swapBlock(direction: "up" | "down"): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;
  const cursorLine = hostEditor.getCursorPosition()!.line;
  const cursorChar = hostEditor.getCursorPosition()!.character;
  const [blockStart, blockEnd] = getBlockRange(doc, cursorLine);

  if (direction === "up") {
    if (blockStart === 0) {
      return; // already at top
    }
    // find adjacent block above (skip blank lines)
    let aboveEnd = blockStart - 1;
    while (aboveEnd > 0 && doc.lineAt(aboveEnd).text.trim() === "") {
      aboveEnd--;
    }
    const [aboveStart] = getBlockRange(doc, aboveEnd);

    {
      const blockText = hostEditor.getDocumentText(
        new Range(blockStart, 0, blockEnd, doc.lineAt(blockEnd).text.length),
      );
      const aboveText = hostEditor.getDocumentText(
        new Range(aboveStart, 0, aboveEnd, doc.lineAt(aboveEnd).text.length),
      );
      // separator between blocks (blank lines between them)
      const sepStart = aboveEnd + 1;
      const sepEnd = blockStart - 1;
      let separator = "";
      if (sepStart <= sepEnd) {
        separator = hostEditor.getDocumentText(new Range(sepStart, 0, sepEnd, doc.lineAt(sepEnd).text.length));
      }
      const fullRange = new Range(aboveStart, 0, blockEnd, doc.lineAt(blockEnd).text.length);
      const sep = separator ? "\n" + separator + "\n" : "\n";
      await hostEditor.replaceRange(fullRange, blockText + sep + aboveText);
    }

    // move cursor to follow the block
    const linesAbove = aboveEnd - aboveStart + 1;
    const sepLines = blockStart - aboveEnd - 1;
    const offset = linesAbove + sepLines;
    const newLine = cursorLine - offset;
    const pos = new Position(newLine, cursorChar);
    hostEditor.setSelection(new Selection(pos, pos));
  } else {
    if (blockEnd >= doc.lineCount - 1) {
      return; // already at bottom
    }
    // find adjacent block below
    let belowStart = blockEnd + 1;
    while (belowStart < doc.lineCount - 1 && doc.lineAt(belowStart).text.trim() === "") {
      belowStart++;
    }
    if (doc.lineAt(belowStart).text.trim() === "") {
      return; // no block below
    }
    const [, belowEnd] = getBlockRange(doc, belowStart);

    {
      const blockText = hostEditor.getDocumentText(
        new Range(blockStart, 0, blockEnd, doc.lineAt(blockEnd).text.length),
      );
      const belowText = hostEditor.getDocumentText(
        new Range(belowStart, 0, belowEnd, doc.lineAt(belowEnd).text.length),
      );
      const sepStart = blockEnd + 1;
      const sepEnd = belowStart - 1;
      let separator = "";
      if (sepStart <= sepEnd) {
        separator = hostEditor.getDocumentText(new Range(sepStart, 0, sepEnd, doc.lineAt(sepEnd).text.length));
      }
      const fullRange = new Range(blockStart, 0, belowEnd, doc.lineAt(belowEnd).text.length);
      const sep = separator ? "\n" + separator + "\n" : "\n";
      await hostEditor.replaceRange(fullRange, belowText + sep + blockText);
    }

    const linesBelow = belowEnd - belowStart + 1;
    const sepLines = belowStart - blockEnd - 1;
    const offset = linesBelow + sepLines;
    const newLine = cursorLine + offset;
    const pos = new Position(newLine, cursorChar);
    hostEditor.setSelection(new Selection(pos, pos));
  }
}

export function swapBlockUp(): Promise<void> {
  return swapBlock("up");
}

export function swapBlockDown(): Promise<void> {
  return swapBlock("down");
}
