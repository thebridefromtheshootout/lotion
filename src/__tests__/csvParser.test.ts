import { parseCsvText, parseCsvLine } from "../core/csv";

describe("parseCsvText", () => {
  it("parses a basic comma-separated row", () => {
    expect(parseCsvText("a,b,c")).toEqual([["a", "b", "c"]]);
  });

  it("trims whitespace from cells", () => {
    expect(parseCsvText(" a , b , c ")).toEqual([["a", "b", "c"]]);
  });

  it("preserves whitespace inside quoted cells (after outer trim)", () => {
    // The outer trim still runs on the full quoted output.
    expect(parseCsvText('"a a","b b"')).toEqual([["a a", "b b"]]);
  });

  it("doubles quotes decode to a single quote", () => {
    expect(parseCsvText('"she said ""hi"""')).toEqual([['she said "hi"']]);
  });

  it("commas inside quoted cells are part of the value", () => {
    expect(parseCsvText('"a,b","c"')).toEqual([["a,b", "c"]]);
  });

  it("handles \\n row separators", () => {
    expect(parseCsvText("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles \\r\\n row separators", () => {
    expect(parseCsvText("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("preserves embedded newlines inside quoted cells", () => {
    expect(parseCsvText('"line1\nline2",end')).toEqual([["line1\nline2", "end"]]);
  });

  it("drops fully-empty rows", () => {
    expect(parseCsvText("a,b\n\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCsvText("")).toEqual([]);
  });
});

describe("parseCsvLine", () => {
  it("parses a single row", () => {
    expect(parseCsvLine("alpha,beta,gamma")).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns [] when given an empty line", () => {
    expect(parseCsvLine("")).toEqual([]);
  });

  it("decodes doubled quotes the same as parseCsvText", () => {
    expect(parseCsvLine('"x ""y"" z"')).toEqual(['x "y" z']);
  });
});
