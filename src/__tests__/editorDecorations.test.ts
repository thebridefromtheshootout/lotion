/**
 * Tests for the regex patterns and visual classification logic
 * used in editor decorations (callouts, highlights, code blocks).
 */

// We test the regex patterns directly since the decoration application
// requires the full VS Code API.

const CALLOUT_OPEN_RE = /^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i;
const CALLOUT_CONT_RE = /^>/;
const HIGHLIGHT_RE = /==[^=\n]+?==/g;
const FENCE_RE = /^```/;

describe("CALLOUT_OPEN_RE", () => {
  it("matches standard callout syntax", () => {
    expect(CALLOUT_OPEN_RE.test("> [!NOTE]")).toBe(true);
    expect(CALLOUT_OPEN_RE.test("> [!TIP]")).toBe(true);
    expect(CALLOUT_OPEN_RE.test("> [!WARNING]")).toBe(true);
    expect(CALLOUT_OPEN_RE.test("> [!IMPORTANT]")).toBe(true);
    expect(CALLOUT_OPEN_RE.test("> [!CAUTION]")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(CALLOUT_OPEN_RE.test("> [!note]")).toBe(true);
    expect(CALLOUT_OPEN_RE.test("> [!Note]")).toBe(true);
    expect(CALLOUT_OPEN_RE.test("> [!WARNING]")).toBe(true);
  });

  it("captures the callout type", () => {
    const match = "> [!WARNING] Be careful".match(CALLOUT_OPEN_RE);
    expect(match).not.toBeNull();
    expect(match![1].toUpperCase()).toBe("WARNING");
  });

  it("does not match regular blockquotes", () => {
    expect(CALLOUT_OPEN_RE.test("> Just a quote")).toBe(false);
  });

  it("does not match non-blockquote lines", () => {
    expect(CALLOUT_OPEN_RE.test("[!NOTE]")).toBe(false);
    expect(CALLOUT_OPEN_RE.test("  [!TIP]")).toBe(false);
  });
});

describe("CALLOUT_CONT_RE", () => {
  it("matches continuation lines", () => {
    expect(CALLOUT_CONT_RE.test(">")).toBe(true);
    expect(CALLOUT_CONT_RE.test("> continued text")).toBe(true);
    expect(CALLOUT_CONT_RE.test(">more")).toBe(true);
  });

  it("does not match non-blockquote lines", () => {
    expect(CALLOUT_CONT_RE.test("plain text")).toBe(false);
    expect(CALLOUT_CONT_RE.test("  > indented")).toBe(false);
  });
});

describe("HIGHLIGHT_RE", () => {
  it("matches ==highlighted text==", () => {
    const matches = "This ==is highlighted== text".match(HIGHLIGHT_RE);
    expect(matches).toHaveLength(1);
    expect(matches![0]).toBe("==is highlighted==");
  });

  it("matches multiple highlights on one line", () => {
    HIGHLIGHT_RE.lastIndex = 0;
    const matches = "==one== and ==two==".match(HIGHLIGHT_RE);
    expect(matches).toHaveLength(2);
  });

  it("does not match empty highlights", () => {
    const matches = "====".match(HIGHLIGHT_RE);
    expect(matches).toBeNull();
  });

  it("does not match across newlines", () => {
    // Each line tested separately (regex is applied per-line in the decorator)
    const matches = "==start".match(HIGHLIGHT_RE);
    expect(matches).toBeNull();
  });

  it("does not match single equals", () => {
    const matches = "=not a highlight=".match(HIGHLIGHT_RE);
    expect(matches).toBeNull();
  });
});

describe("FENCE_RE", () => {
  it("matches opening code fences", () => {
    expect(FENCE_RE.test("```")).toBe(true);
    expect(FENCE_RE.test("```javascript")).toBe(true);
    expect(FENCE_RE.test("```ts")).toBe(true);
  });

  it("matches closing code fences", () => {
    expect(FENCE_RE.test("```")).toBe(true);
  });

  it("does not match inline code", () => {
    expect(FENCE_RE.test("  `inline`")).toBe(false);
  });

  it("does not match double backticks", () => {
    // trimmed version would be "``" which doesn't start with ```
    expect(FENCE_RE.test("``")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Line classification (simulated decorator scan)
// ═══════════════════════════════════════════════════════════════════

interface LineClassification {
  type: "callout" | "callout-continuation" | "code" | "highlight" | "normal";
  calloutType?: string;
  highlightRanges?: Array<[number, number]>;
}

/**
 * Simulate the line-scanning logic from editorDecorations.ts
 */
function classifyLines(lines: string[]): LineClassification[] {
  const result: LineClassification[] = [];
  let inFence = false;
  let currentCalloutType: string | null = null;

  for (const line of lines) {
    if (FENCE_RE.test(line.trim())) {
      if (inFence) {
        result.push({ type: "code" });
        inFence = false;
        continue;
      } else {
        inFence = true;
        result.push({ type: "code" });
        continue;
      }
    }

    if (inFence) {
      result.push({ type: "code" });
      continue;
    }

    const calloutMatch = line.match(CALLOUT_OPEN_RE);
    if (calloutMatch) {
      currentCalloutType = calloutMatch[1].toUpperCase();
      result.push({ type: "callout", calloutType: currentCalloutType });
      continue;
    }

    if (currentCalloutType && CALLOUT_CONT_RE.test(line)) {
      result.push({ type: "callout-continuation", calloutType: currentCalloutType });
      continue;
    } else {
      currentCalloutType = null;
    }

    // Check for highlights
    HIGHLIGHT_RE.lastIndex = 0;
    const hlRanges: Array<[number, number]> = [];
    let m: RegExpExecArray | null;
    while ((m = HIGHLIGHT_RE.exec(line)) !== null) {
      hlRanges.push([m.index + 2, m.index + m[0].length - 2]);
    }

    if (hlRanges.length > 0) {
      result.push({ type: "highlight", highlightRanges: hlRanges });
    } else {
      result.push({ type: "normal" });
    }
  }

  return result;
}

describe("classifyLines (simulated editor decorations)", () => {
  it("classifies callout blocks correctly", () => {
    const lines = ["> [!NOTE] Important", "> More detail here", "> Last line", "", "Normal text"];
    const result = classifyLines(lines);
    expect(result[0]).toEqual({ type: "callout", calloutType: "NOTE" });
    expect(result[1]).toEqual({ type: "callout-continuation", calloutType: "NOTE" });
    expect(result[2]).toEqual({ type: "callout-continuation", calloutType: "NOTE" });
    expect(result[3].type).toBe("normal");
    expect(result[4].type).toBe("normal");
  });

  it("classifies fenced code blocks", () => {
    const lines = ["```typescript", "const x = 1;", "```", "Outside"];
    const result = classifyLines(lines);
    expect(result[0].type).toBe("code");
    expect(result[1].type).toBe("code");
    expect(result[2].type).toBe("code");
    expect(result[3].type).toBe("normal");
  });

  it("finds highlight ranges", () => {
    const lines = ["This ==is highlighted== text"];
    const result = classifyLines(lines);
    expect(result[0].type).toBe("highlight");
    expect(result[0].highlightRanges).toEqual([[7, 21]]);
  });

  it("handles interleaved blocks correctly", () => {
    const lines = ["> [!TIP] A tip", "> Details", "", "```", "code line", "```", "", "==marked text=="];
    const result = classifyLines(lines);
    expect(result[0].calloutType).toBe("TIP");
    expect(result[1].calloutType).toBe("TIP");
    expect(result[2].type).toBe("normal");
    expect(result[3].type).toBe("code");
    expect(result[4].type).toBe("code");
    expect(result[5].type).toBe("code");
    expect(result[6].type).toBe("normal");
    expect(result[7].type).toBe("highlight");
  });
});
