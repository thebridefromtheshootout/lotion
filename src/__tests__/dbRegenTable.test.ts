import { findMarkedTableAround } from "../database/dbRegenTable";

interface MockLine {
  text: string;
}
interface MockDoc {
  lineCount: number;
  lineAt(i: number): MockLine;
}

function mkDoc(text: string): MockDoc {
  const lines = text.split("\n");
  return {
    lineCount: lines.length,
    lineAt(i: number) {
      return { text: lines[i] };
    },
  };
}

describe("findMarkedTableAround", () => {
  const sample = [
    "Some prose.",
    "",
    '<!-- lotion-db-table source="projects/index.md" -->',
    "| Title | Status |",
    "| ----- | ------ |",
    "| Alpha | todo   |",
    "| Beta  | done   |",
    "",
    "More prose.",
  ].join("\n");

  it("finds the region when the cursor is on the marker line", () => {
    const region = findMarkedTableAround(mkDoc(sample) as any, 2);
    expect(region).toEqual({ sourcePath: "projects/index.md", markerLine: 2, endLine: 6 });
  });

  it("finds the region when the cursor is on a data row", () => {
    const region = findMarkedTableAround(mkDoc(sample) as any, 5);
    expect(region).toEqual({ sourcePath: "projects/index.md", markerLine: 2, endLine: 6 });
  });

  it("returns undefined when the cursor is outside the table", () => {
    expect(findMarkedTableAround(mkDoc(sample) as any, 0)).toBeUndefined();
    expect(findMarkedTableAround(mkDoc(sample) as any, 8)).toBeUndefined();
  });

  it("returns undefined when no marker exists upstream", () => {
    const plain = ["| a | b |", "| - | - |", "| 1 | 2 |"].join("\n");
    expect(findMarkedTableAround(mkDoc(plain) as any, 1)).toBeUndefined();
  });

  it("finds the marker for large tables (>32 rows)", () => {
    const N = 50;
    const lines = [
      '<!-- lotion-db-table source="big/index.md" -->',
      "| col |",
      "| --- |",
      ...Array.from({ length: N }, (_, i) => `| r${i} |`),
    ];
    const doc = mkDoc(lines.join("\n"));
    // Cursor on the very last data row (line 2 + N).
    const region = findMarkedTableAround(doc as any, 2 + N);
    expect(region).toEqual({ sourcePath: "big/index.md", markerLine: 0, endLine: 2 + N });
  });

  it("does not associate a marker with an unrelated table further down", () => {
    const split = [
      '<!-- lotion-db-table source="a/index.md" -->',
      "| x |",
      "| - |",
      "",
      "Paragraph.",
      "",
      "| y |",
      "| - |",
      "| 7 |",
    ].join("\n");
    // Cursor on the second, marker-less table → no region.
    expect(findMarkedTableAround(mkDoc(split) as any, 8)).toBeUndefined();
  });
});
