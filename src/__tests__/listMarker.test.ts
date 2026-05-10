import {
  classifyMarker,
  continuationMarker,
  findMarkerAtIndent,
  findSameIndentParentMarker,
  isCheckboxMarker,
  sameStyle,
} from "../lists/listMarker";

interface MockLine {
  text: string;
}
interface MockDoc {
  lineCount: number;
  lineAt(i: number): MockLine;
}

function mkDoc(lines: string[]): MockDoc {
  return {
    lineCount: lines.length,
    lineAt(i: number) {
      return { text: lines[i] };
    },
  };
}

describe("isCheckboxMarker", () => {
  it("matches unchecked / checked variants", () => {
    expect(isCheckboxMarker("- [ ] ")).toBe(true);
    expect(isCheckboxMarker("- [x] ")).toBe(true);
    expect(isCheckboxMarker("- [X] ")).toBe(true);
    expect(isCheckboxMarker("* [ ] ")).toBe(true);
    expect(isCheckboxMarker("+ [ ] ")).toBe(true);
  });

  it("rejects non-checkbox markers", () => {
    expect(isCheckboxMarker("- ")).toBe(false);
    expect(isCheckboxMarker("1. ")).toBe(false);
    expect(isCheckboxMarker("- [other] ")).toBe(false);
  });
});

describe("classifyMarker", () => {
  it("classifies ordered markers", () => {
    expect(classifyMarker("1. ")).toEqual({ ordered: true, sep: ".", num: 1 });
    expect(classifyMarker("42) ")).toEqual({ ordered: true, sep: ")", num: 42 });
  });

  it("classifies unordered markers", () => {
    expect(classifyMarker("- ")).toEqual({ ordered: false, bullet: "-" });
    expect(classifyMarker("* ")).toEqual({ ordered: false, bullet: "*" });
    expect(classifyMarker("+ ")).toEqual({ ordered: false, bullet: "+" });
  });
});

describe("sameStyle", () => {
  it("matches ordered with the same separator", () => {
    expect(sameStyle({ ordered: true, sep: "." }, { ordered: true, sep: "." })).toBe(true);
    expect(sameStyle({ ordered: true, sep: "." }, { ordered: true, sep: ")" })).toBe(false);
  });

  it("matches unordered with the same bullet", () => {
    expect(sameStyle({ ordered: false, bullet: "-" }, { ordered: false, bullet: "-" })).toBe(true);
    expect(sameStyle({ ordered: false, bullet: "-" }, { ordered: false, bullet: "*" })).toBe(false);
  });

  it("rejects mixed ordered vs unordered", () => {
    expect(sameStyle({ ordered: true, sep: "." }, { ordered: false, bullet: "-" })).toBe(false);
  });
});

describe("continuationMarker", () => {
  it("increments ordered list numbers", () => {
    expect(continuationMarker("1. ")).toBe("2. ");
    expect(continuationMarker("9) ")).toBe("10) ");
  });

  it("emits unchecked for any checkbox", () => {
    expect(continuationMarker("- [x] ")).toBe("- [ ] ");
    expect(continuationMarker("- [ ] ")).toBe("- [ ] ");
  });

  it("copies unordered markers verbatim", () => {
    expect(continuationMarker("- ")).toBe("- ");
    expect(continuationMarker("* ")).toBe("* ");
  });
});

describe("findMarkerAtIndent", () => {
  it("finds the same-indent parent marker walking upward", () => {
    const doc = mkDoc([
      "- alpha",
      "- beta",
      "  - sub",
      "  - sub2",
    ]);
    // From line 3, looking for indent=2 → should find at line 2 ('  - sub').
    expect(findMarkerAtIndent(doc as any, 3, 2)).toEqual({ ordered: false, bullet: "-" });
  });

  it("returns null when a shallower-indent line is hit before any matching marker", () => {
    const doc = mkDoc([
      "alpha",
      "- only-bullet",
    ]);
    // Looking for a deeper-indent marker that doesn't exist; the prose line 0
    // is shallower than indent=2 → null.
    expect(findMarkerAtIndent(doc as any, 1, 2)).toBeNull();
  });

  it("skips deeper-indent intervening lines", () => {
    const doc = mkDoc([
      "1. one",
      "    extra detail",
      "    - sub",
      "2. two",
    ]);
    expect(findMarkerAtIndent(doc as any, 3, 0)).toEqual({ ordered: true, sep: ".", num: 1 });
  });
});

describe("findSameIndentParentMarker", () => {
  it("finds the parent marker on a previous line at the same indent (zero-indent case)", () => {
    // findSameIndentParentMarker requires *strictly* the same leading
    // whitespace on the continuation line and the marker line, so this
    // covers the shift-enter case (no leading whitespace on the
    // continuation line).
    const doc = mkDoc(["- first item", "continuation"]);
    expect(findSameIndentParentMarker(doc as any, 1)).toEqual({ indent: "", parentMarker: "- " });
  });

  it("requires the continuation indent to match exactly", () => {
    // "  continuation" has indent "  " but "- first item" has indent "".
    // These don't match, so the function returns null.
    const doc = mkDoc(["- first item", "  continuation"]);
    expect(findSameIndentParentMarker(doc as any, 1)).toBeNull();
  });

  it("returns null when the current line already has a marker", () => {
    const doc = mkDoc(["- a", "- b"]);
    expect(findSameIndentParentMarker(doc as any, 1)).toBeNull();
  });

  it("returns null when an indent change is hit on the way up", () => {
    const doc = mkDoc(["  - indented", "different-indent continuation"]);
    expect(findSameIndentParentMarker(doc as any, 1)).toBeNull();
  });

  it("returns null when a blank line is hit on the way up", () => {
    const doc = mkDoc(["- top", "", "continuation"]);
    expect(findSameIndentParentMarker(doc as any, 2)).toBeNull();
  });
});
