
import { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";


// ── Re-export cursorIn* from their modules ─────────────────────────
import { cursorInDb } from "../database/dbEntries";
import { cursorInTable } from "../editor/table";
import { cursorInProcessor } from "../editor/processor";
import { cursorInCodeContext } from "../editor/codeContext";
import { cursorInGraph } from "../media/graph";
import { cursorInSecretbox } from "../blocks/lockBlock";
import { cursorInOrderedList, cursorInUnorderedList } from "../lists/listModel";

export interface CursorContext {
  pageIsDbIndex: boolean;
  cursorInTable: boolean;
  cursorInList: boolean;
  cursorInOrderedList: boolean;
  cursorInUnorderedList: boolean;
  cursorInCode: boolean;
  cursorInProcessor: boolean;
  cursorInGraph: boolean;
  cursorInSecretbox: boolean;
}

export function computeCursorContext(doc: TextDocument, pos: Position): CursorContext {
  const inOrderedList = cursorInOrderedList(doc, pos);
  const inUnorderedList = cursorInUnorderedList(doc, pos);
  return {
    pageIsDbIndex: cursorInDb(doc, pos),
    cursorInTable: cursorInTable(doc, pos),
    cursorInList: inOrderedList || inUnorderedList,
    cursorInOrderedList: inOrderedList,
    cursorInUnorderedList: inUnorderedList,
    cursorInCode: cursorInCodeContext(doc, pos),
    cursorInProcessor: cursorInProcessor(doc, pos),
    cursorInGraph: cursorInGraph(doc, pos),
    cursorInSecretbox: cursorInSecretbox(doc, pos),
  };
}
