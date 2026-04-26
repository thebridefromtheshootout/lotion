import { getBlockIndex } from "../core/blockIndex";

interface MockLine {
  text: string;
}
interface MockDoc {
  version: number;
  lineCount: number;
  languageId: string;
  lineAt(i: number): MockLine;
}

function mkDoc(text: string, version = 1): MockDoc {
  const lines = text.split("\n");
  return {
    version,
    languageId: "markdown",
    lineCount: lines.length,
    lineAt(i: number) {
      return { text: lines[i] };
    },
  };
}

describe("blockIndex.codeFences", () => {
  it("captures a single fenced block", () => {
    const doc = mkDoc(["alpha", "```js", "code", "```", "beta"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.codeFences).toHaveLength(1);
    expect(idx.codeFences[0]).toMatchObject({ startLine: 1, endLine: 3, fenceChar: "`", lang: "js" });
  });

  it("isInCodeFence is true for fenced lines and the fence markers themselves", () => {
    const doc = mkDoc(["a", "```", "x", "```", "b"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.isInCodeFence(0)).toBe(false);
    expect(idx.isInCodeFence(1)).toBe(true);
    expect(idx.isInCodeFence(2)).toBe(true);
    expect(idx.isInCodeFence(3)).toBe(true);
    expect(idx.isInCodeFence(4)).toBe(false);
  });

  it("treats unclosed fence as fenced through end of doc", () => {
    const doc = mkDoc(["a", "```", "x", "y"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.codeFences).toHaveLength(1);
    expect(idx.codeFences[0].endLine).toBe(3);
  });

  it("does not match ``` mismatched with ~~~", () => {
    const doc = mkDoc(["```", "x", "~~~", "y", "```"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.codeFences).toHaveLength(1);
    expect(idx.codeFences[0]).toMatchObject({ startLine: 0, endLine: 4, fenceChar: "`" });
  });
});

describe("blockIndex.detailsBlocks", () => {
  it("captures a basic <details>", () => {
    const doc = mkDoc(["<details>", "<summary>Title</summary>", "body", "</details>"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.detailsBlocks).toHaveLength(1);
    expect(idx.detailsBlocks[0]).toMatchObject({
      startLine: 0,
      endLine: 3,
      summaryStartLine: 1,
      summaryEndLine: 1,
      summaryText: "Title",
      bodyStartLine: 2,
      bodyEndLine: 2,
      kind: "plain",
    });
  });

  it("detects secretbox kind", () => {
    const doc = mkDoc(
      ["<details><!--lotion-secretbox-->", "<summary>Secret</summary>", "stuff", "</details>"].join("\n"),
    );
    const idx = getBlockIndex(doc as any);
    expect(idx.detailsBlocks).toHaveLength(1);
    expect(idx.detailsBlocks[0].kind).toBe("secretbox");
  });

  it("detects graph kind via dot fence in body", () => {
    const doc = mkDoc(
      ["<details>", "<summary>g</summary>", "```dot", "digraph {}", "```", "</details>"].join("\n"),
    );
    const idx = getBlockIndex(doc as any);
    expect(idx.detailsBlocks[0].kind).toBe("graph");
  });

  it("ignores <details> inside a code fence", () => {
    const doc = mkDoc(
      ["```", "<details>", "<summary>t</summary>", "x", "</details>", "```"].join("\n"),
    );
    const idx = getBlockIndex(doc as any);
    expect(idx.detailsBlocks).toHaveLength(0);
  });

  it("detailsBlockAt returns the right block", () => {
    const doc = mkDoc(["<details>", "<summary>a</summary>", "b", "</details>"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.detailsBlockAt(2)?.summaryText).toBe("a");
    expect(idx.detailsBlockAt(99)).toBeUndefined();
  });
});

describe("blockIndex.callouts", () => {
  it("captures a NOTE with continuation lines", () => {
    const doc = mkDoc(["> [!NOTE]", "> first line", "> second line", "", "outside"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.callouts).toHaveLength(1);
    expect(idx.callouts[0]).toMatchObject({ startLine: 0, endLine: 2, kind: "NOTE" });
  });

  it("captures multiple callouts and resolves calloutAt", () => {
    const doc = mkDoc(
      ["> [!TIP]", "> tip body", "", "> [!WARNING]", "> w body"].join("\n"),
    );
    const idx = getBlockIndex(doc as any);
    expect(idx.callouts).toHaveLength(2);
    expect(idx.calloutAt(1)?.kind).toBe("TIP");
    expect(idx.calloutAt(4)?.kind).toBe("WARNING");
    expect(idx.calloutAt(2)).toBeUndefined();
  });
});

describe("blockIndex.tables", () => {
  it("captures a basic markdown table", () => {
    const doc = mkDoc(["| a | b |", "|---|---|", "| 1 | 2 |", "| 3 | 4 |", "outside"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.tables).toHaveLength(1);
    expect(idx.tables[0]).toMatchObject({
      startLine: 0,
      endLine: 3,
      headerLine: 0,
      separatorLine: 1,
      dataStartLine: 2,
    });
  });

  it("requires a separator row directly below the header", () => {
    const doc = mkDoc(["| a | b |", "| 1 | 2 |"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.tables).toHaveLength(0);
  });

  it("tableAt returns the table for any data line", () => {
    const doc = mkDoc(["| a |", "|---|", "| 1 |", "| 2 |"].join("\n"));
    const idx = getBlockIndex(doc as any);
    expect(idx.tableAt(2)).toBeDefined();
    expect(idx.tableAt(3)).toBeDefined();
    expect(idx.tableAt(4)).toBeUndefined();
  });
});

describe("blockIndex caching", () => {
  it("reuses the cached index across calls at the same version", () => {
    const doc = mkDoc("# h\n");
    const a = getBlockIndex(doc as any);
    const b = getBlockIndex(doc as any);
    expect(a).toBe(b);
  });

  it("rebuilds when doc.version changes", () => {
    const doc = mkDoc("# h\n", 1);
    const a = getBlockIndex(doc as any);
    doc.version = 2;
    const b = getBlockIndex(doc as any);
    expect(a).not.toBe(b);
    expect(b.version).toBe(2);
  });
});
