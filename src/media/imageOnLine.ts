import type { Position, TextDocument } from "../hostEditor/EditorTypes";
import { parseImageLine } from "./imageBlock";

/**
 * True when the cursor sits on a line that contains an image (either
 * `![alt](src)` or an `<img>` tag). Used to gate image-mutating slash
 * commands so they only appear when the action is meaningful.
 */
export function cursorOnImage(doc: TextDocument, pos: Position): boolean {
  if (pos.line >= doc.lineCount) return false;
  const line = doc.lineAt(pos.line).text;
  return parseImageLine(line) !== null;
}
