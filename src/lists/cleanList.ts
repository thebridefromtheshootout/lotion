import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

const LIST_ITEM_RE = /^(\s*)(?:[-*+]\s+|\d+[.)]\s+|-\s+\[[ xX]\]\s+)/;

export const CLEAN_LIST_SLASH_COMMAND: SlashCommand = {
  label: "/clean-list",
  insertText: "",
  detail: "🧹 Remove empty lines inside current list",
  isAction: true,
  commandId: Cmd.cleanList,
  kind: 11,
  when: cursorInAnyList,
  handler: handleCleanList,
};

function lineIndent(lineText: string): number {
  return (lineText.match(/^(\s*)/)?.[1].length ?? 0);
}

function isListItem(lineText: string): boolean {
  return LIST_ITEM_RE.test(lineText);
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

  const deleteRanges: Range[] = [];
  for (let i = start; i <= end; i++) {
    const text = doc.lineAt(i).text;
    if (text.trim() !== "") {
      continue;
    }
    if (i < doc.lineCount - 1) {
      deleteRanges.push(new Range(new Position(i, 0), new Position(i + 1, 0)));
    } else {
      deleteRanges.push(new Range(new Position(i, 0), new Position(i, text.length)));
    }
  }

  if (deleteRanges.length === 0) {
    hostEditor.showInformation("List has no empty lines to remove.");
    return;
  }

  await hostEditor.batchDeleteRanges(deleteRanges);
}
