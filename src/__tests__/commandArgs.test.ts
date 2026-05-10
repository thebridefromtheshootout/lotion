import { parseCommandArgs } from "../core/commandArgs";

describe("parseCommandArgs", () => {
  it("classifies (docUri, line, char) as a slash invocation", () => {
    expect(parseCommandArgs(["file:///x.md", 12, 3])).toEqual({
      kind: "slash",
      docUri: "file:///x.md",
      line: 12,
      character: 3,
    });
  });

  it("ignores extra args after the (docUri, line, char) triple", () => {
    expect(parseCommandArgs(["file:///x.md", 0, 0, "extra", { foo: 1 }])).toMatchObject({
      kind: "slash",
    });
  });

  it("classifies a non-file: string as an fsPath invocation (CodeLens / webview)", () => {
    const r = parseCommandArgs(["/abs/path/index.md"]);
    expect(r).toEqual({ kind: "fsPath", fsPath: "/abs/path/index.md", rest: [] });
  });

  it("captures additional args from the fsPath form into `rest`", () => {
    const r = parseCommandArgs(["/abs/path/index.md", { Status: "Active" }]);
    expect(r.kind).toBe("fsPath");
    if (r.kind === "fsPath") {
      expect(r.rest).toEqual([{ Status: "Active" }]);
    }
  });

  it("does NOT classify a 'file:'-prefixed string as fsPath", () => {
    // file:-prefixed strings are slash docUris; they shouldn't fall into the
    // CodeLens path even when called with one argument.
    expect(parseCommandArgs(["file:///x.md"])).toEqual({ kind: "active" });
  });

  it("returns 'active' for an empty arg list", () => {
    expect(parseCommandArgs([])).toEqual({ kind: "active" });
  });

  it("returns 'active' for a non-string first arg", () => {
    expect(parseCommandArgs([42])).toEqual({ kind: "active" });
    expect(parseCommandArgs([{}])).toEqual({ kind: "active" });
  });

  it("returns 'active' when only two slash args are provided", () => {
    expect(parseCommandArgs(["file:///x.md", 0])).toEqual({ kind: "active" });
  });
});
