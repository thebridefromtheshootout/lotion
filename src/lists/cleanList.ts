import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";
import { collectOrderedList, renumberEdits, applyRenumberEdits } from "./listModel";

const LIST_ITEM_RE = Regex.listItem;
const EMPTY_LIST_ITEM_RE = Regex.emptyListItem;
const ORDERED_LIST_RE = Regex.orderedListItem;

export const CLEAN_LIST_SLASH_COMMAND: SlashCommand = {
  label: "/clean-list",
  insertText: "",
  detail: "🧹 Remove empty lines/items in current list",
  isAction: true,
  commandId: Cmd.cleanList,
  kind: 11,
  when: cursorInAnyList,
  handler: handleCleanList,
};

function lineIndent(lineText: string): number {
  return (lineText.match(Regex.lineIndent)?.[1].length ?? 0);
}

function isListItem(lineText: string): boolean {
  return LIST_ITEM_RE.test(lineText);
}

function isEmptyListItem(lineText: string): boolean {
  return EMPTY_LIST_ITEM_RE.test(lineText);
}

function findListBounds(doc: TextDocument, anchorLine: number, baseIndent: number): { start: number; end: number } {
  let start = anchorLine;
  while (start > 0) {
    const prevText = doc.lineAt(start - 1).text;
    if (prevText.trim() === "") {
      start--;
      continue;
    }
    if (isListItem(prevText) && lineIndent(prevText) === baseIndent) {
      start--;
      continue;
    }
    if (lineIndent(prevText) > baseIndent) {
      start--;
      continue;
    }
    break;
  }

  let end = anchorLine;
  while (end < doc.lineCount - 1) {
    const nextText = doc.lineAt(end + 1).text;
    if (nextText.trim() === "") {
      end++;
      continue;
    }
    if (isListItem(nextText) && lineIndent(nextText) === baseIndent) {
      end++;
      continue;
    }
    if (lineIndent(nextText) > baseIndent) {
      end++;
      continue;
    }
    break;
  }

  return { start, end };
}

async function renumberOrderedListsInRange(doc: TextDocument, start: number, end: number): Promise<void> {
  const visited = new Set<number>();
  const allEdits: { line: number; col: number; oldLen: number; newText: string }[] = [];

  for (let i = start; i <= end; i++) {
    if (visited.has(i)) {
      continue;
    }
    if (!ORDERED_LIST_RE.test(doc.lineAt(i).text)) {
      continue;
    }

    const items = collectOrderedList(doc, i);
    if (items.length === 0) {
      continue;
    }

    for (const node of items) {
      if (node.line >= start && node.line <= end) {
        visited.add(node.line);
      }
    }

    allEdits.push(...renumberEdits(doc, items, 0, 1));
    i = Math.min(end, items[items.length - 1].line);
  }

  await applyRenumberEdits(allEdits);
}

function cursorInAnyList(document: TextDocument, position: Position): boolean {
  const line = document.lineAt(position.line).text;
  if (isListItem(line)) {
    return true;
  }
  if (line.trim() !== "") {
    return false;
  }

  // Allow invocation on blank lines surrounded by list content.
  const prev = position.line > 0 ? document.lineAt(position.line - 1).text : "";
  const next = position.line + 1 < document.lineCount ? document.lineAt(position.line + 1).text : "";
  return isListItem(prev) || isListItem(next);
}

function findAnchorListLine(doc: TextDocument, cursorLine: number): number | undefined {
  if (isListItem(doc.lineAt(cursorLine).text)) {
    return cursorLine;
  }

  for (let i = cursorLine - 1; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    if (text.trim() === "") {
      continue;
    }
    return isListItem(text) ? i : undefined;
  }
  return undefined;
}

export async function handleCleanList(doc: TextDocument, _pos: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(doc)) {
    return;
  }

  const cursorLine = hostEditor.getCursorPosition()!.line;
  const anchorLine = findAnchorListLine(doc, cursorLine);
  if (anchorLine === undefined) {
    hostEditor.showWarning("Place cursor in a list to clean it.");
    return;
  }

  const anchorMatch = doc.lineAt(anchorLine).text.match(LIST_ITEM_RE);
  if (!anchorMatch) {
    return;
  }
  const baseIndent = anchorMatch[1].length;

  const { start, end } = findListBounds(doc, anchorLine, baseIndent);

  const deleteRanges: Range[] = [];
  for (let i = start; i <= end; i++) {
    const text = doc.lineAt(i).text;
    if (text.trim() !== "" && !isEmptyListItem(text)) {
      continue;
    }
    if (i < doc.lineCount - 1) {
      deleteRanges.push(new Range(new Position(i, 0), new Position(i + 1, 0)));
    } else {
      deleteRanges.push(new Range(new Position(i, 0), new Position(i, text.length)));
    }
  }

  if (deleteRanges.length === 0) {
    hostEditor.showInformation("List has no empty lines/items to remove.");
    return;
  }

  await hostEditor.batchDeleteRanges(deleteRanges);

  // Keep ordered lists sequential after item removals.
  const updatedDoc = hostEditor.getDocument();
  if (!updatedDoc || updatedDoc.lineCount === 0) {
    return;
  }

  const probeLine = Math.min(anchorLine, updatedDoc.lineCount - 1);
  const updatedAnchor = findAnchorListLine(updatedDoc, probeLine);
  if (updatedAnchor === undefined) {
    return;
  }

  const updatedAnchorMatch = updatedDoc.lineAt(updatedAnchor).text.match(LIST_ITEM_RE);
  if (!updatedAnchorMatch) {
    return;
  }

  const updatedBaseIndent = updatedAnchorMatch[1].length;
  const updatedBounds = findListBounds(updatedDoc, updatedAnchor, updatedBaseIndent);
  await renumberOrderedListsInRange(updatedDoc, updatedBounds.start, updatedBounds.end);
}
