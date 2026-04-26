import { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";
import { getBlockIndex } from "../core/blockIndex";

/**
 * Returns true if `position` is inside either:
 * - a fenced code block (``` or ~~~), or
 * - an inline code span delimited by backticks.
 */
export function cursorInCodeContext(document: TextDocument, position: Position): boolean {
  if (getBlockIndex(document).isInCodeFence(position.line)) {
    return true;
  }
  return isInsideInlineCode(document.lineAt(position.line).text, position.character);
}

function isInsideInlineCode(lineText: string, character: number): boolean {
  const before = lineText.slice(0, character);
  const backticks = (before.match(Regex.backtick) || []).length;
  return backticks % 2 === 1;
}
