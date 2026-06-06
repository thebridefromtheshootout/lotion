import { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";

// ── Re-export cursorIn* from their modules ─────────────────────────
import { cursorInDb, cursorInDbEntry } from "../database/dbEntries";
import { cursorInTable } from "../editor/table";
import { cursorInProcessor } from "../editor/processor";
import { cursorInCodeContext } from "../editor/codeContext";
import { cursorInGraph } from "../media/graph";
import { cursorInSecretbox } from "../blocks/lockBlock";
import { cursorInOrderedList, cursorInUnorderedList } from "../lists/listModel";
import { cursorInWeekBlock, cursorInWeekDaySection } from "../productivity/weeklyPlan";

export interface CursorContext {
  pageIsDbIndex: boolean;
  pageIsDbEntry: boolean;
  cursorInTable: boolean;
  cursorInList: boolean;
  cursorInOrderedList: boolean;
  cursorInUnorderedList: boolean;
  cursorInCode: boolean;
  cursorInProcessor: boolean;
  cursorInGraph: boolean;
  cursorInSecretbox: boolean;
  cursorInWeekBlock: boolean;
  cursorInWeekDaySection: boolean;
}

export function computeCursorContext(doc: TextDocument, pos: Position): CursorContext {
  const inOrderedList = cursorInOrderedList(doc, pos);
  const inUnorderedList = cursorInUnorderedList(doc, pos);
  const isDbIndex = cursorInDb(doc, pos);
  const inWeekBlock = cursorInWeekBlock(doc, pos);
  return {
    pageIsDbIndex: isDbIndex,
    pageIsDbEntry: !isDbIndex && cursorInDbEntry(doc, pos),
    cursorInTable: cursorInTable(doc, pos),
    cursorInList: inOrderedList || inUnorderedList,
    cursorInOrderedList: inOrderedList,
    cursorInUnorderedList: inUnorderedList,
    cursorInCode: cursorInCodeContext(doc, pos),
    cursorInProcessor: cursorInProcessor(doc, pos),
    cursorInGraph: cursorInGraph(doc, pos),
    cursorInSecretbox: cursorInSecretbox(doc, pos),
    cursorInWeekBlock: inWeekBlock,
    cursorInWeekDaySection: inWeekBlock && cursorInWeekDaySection(doc, pos),
  };
}
