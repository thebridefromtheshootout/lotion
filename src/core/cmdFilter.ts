import type { CursorContext } from "./cursorContext";

type Pred = (ctx: CursorContext) => boolean;

export class CmdFilter {
  private readonly preds: Pred[] = [];

  private add(p: Pred): this {
    (this.preds as Pred[]).push(p);
    return this;
  }

  pageIsDbIndex() {
    return this.add((c) => c.pageIsDbIndex);
  }
  pageIsNotDbIndex() {
    return this.add((c) => !c.pageIsDbIndex);
  }
  pageIsDbIndexOrEntry() {
    return this.add((c) => c.pageIsDbIndex || c.pageIsDbEntry);
  }
  cursorInTable() {
    return this.add((c) => c.cursorInTable);
  }
  cursorInList() {
    return this.add((c) => c.cursorInList);
  }
  cursorInOrderedList() {
    return this.add((c) => c.cursorInOrderedList);
  }
  cursorInUnorderedList() {
    return this.add((c) => c.cursorInUnorderedList);
  }
  cursorInCode() {
    return this.add((c) => c.cursorInCode);
  }
  cursorNotInCode() {
    return this.add((c) => !c.cursorInCode);
  }
  cursorInProcessor() {
    return this.add((c) => c.cursorInProcessor);
  }
  cursorInGraph() {
    return this.add((c) => c.cursorInGraph);
  }
  cursorInSecretbox() {
    return this.add((c) => c.cursorInSecretbox);
  }
  cursorInWeekBlock() {
    return this.add((c) => c.cursorInWeekBlock);
  }
  cursorInWeekDaySection() {
    return this.add((c) => c.cursorInWeekDaySection);
  }
  cursorOnImage() {
    return this.add((c) => c.cursorOnImage);
  }

  /**
   * True when block-level markdown insertion is meaningful at the cursor —
   * i.e. NOT inside a fenced/inline code span, NOT inside a graph or
   * processor fence, and NOT inside a table cell. Use for slash commands
   * like /h1, /quote, /callout, /toc, etc. whose output renders as literal
   * text (or breaks layout) in those regions.
   */
  cursorAllowsBlockMarkdown() {
    return this.add((c) => !c.cursorInCode && !c.cursorInGraph && !c.cursorInProcessor && !c.cursorInTable);
  }

  evaluate(ctx: CursorContext): boolean {
    return this.preds.every((p) => p(ctx));
  }
}

/** Fluent factory — usage: Filter().cursorInTable() */
export function Filter(): CmdFilter {
  return new CmdFilter();
}
