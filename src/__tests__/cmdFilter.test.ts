import { Filter } from "../core/cmdFilter";
import type { CursorContext } from "../core/cursorContext";

function ctx(overrides: Partial<CursorContext> = {}): CursorContext {
  return {
    pageIsDbIndex: false,
    pageIsDbEntry: false,
    cursorInTable: false,
    cursorInList: false,
    cursorInOrderedList: false,
    cursorInUnorderedList: false,
    cursorInCode: false,
    cursorInProcessor: false,
    cursorInGraph: false,
    cursorInSecretbox: false,
    cursorInWeekBlock: false,
    cursorInWeekDaySection: false,
    cursorOnImage: false,
    ...overrides,
  };
}

describe("CmdFilter — cursorAllowsBlockMarkdown", () => {
  const filter = Filter().cursorAllowsBlockMarkdown();

  it("passes in plain prose context", () => {
    expect(filter.evaluate(ctx())).toBe(true);
  });

  it("passes in a list (lists allow nested block markdown)", () => {
    expect(filter.evaluate(ctx({ cursorInList: true, cursorInUnorderedList: true }))).toBe(true);
  });

  it("blocks in a fenced code block", () => {
    expect(filter.evaluate(ctx({ cursorInCode: true }))).toBe(false);
  });

  it("blocks in inline code (cursorInCode is true for inline too)", () => {
    expect(filter.evaluate(ctx({ cursorInCode: true }))).toBe(false);
  });

  it("blocks in a table cell", () => {
    expect(filter.evaluate(ctx({ cursorInTable: true }))).toBe(false);
  });

  it("blocks in a graph fence", () => {
    expect(filter.evaluate(ctx({ cursorInGraph: true }))).toBe(false);
  });

  it("blocks in a processor fence", () => {
    expect(filter.evaluate(ctx({ cursorInProcessor: true }))).toBe(false);
  });
});

describe("CmdFilter — composition", () => {
  it("AND-composes multiple predicates", () => {
    const filter = Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown();
    expect(filter.evaluate(ctx())).toBe(true);
    expect(filter.evaluate(ctx({ pageIsDbIndex: true }))).toBe(false);
    expect(filter.evaluate(ctx({ cursorInCode: true }))).toBe(false);
    expect(filter.evaluate(ctx({ pageIsDbIndex: true, cursorInCode: true }))).toBe(false);
  });

  it("cursorNotInCode is the negation of cursorInCode", () => {
    expect(Filter().cursorNotInCode().evaluate(ctx())).toBe(true);
    expect(
      Filter()
        .cursorNotInCode()
        .evaluate(ctx({ cursorInCode: true })),
    ).toBe(false);
    expect(
      Filter()
        .cursorInCode()
        .evaluate(ctx({ cursorInCode: true })),
    ).toBe(true);
    expect(Filter().cursorInCode().evaluate(ctx())).toBe(false);
  });

  it("cursorOnImage passes only when the flag is set", () => {
    expect(Filter().cursorOnImage().evaluate(ctx())).toBe(false);
    expect(
      Filter()
        .cursorOnImage()
        .evaluate(ctx({ cursorOnImage: true })),
    ).toBe(true);
  });
});
