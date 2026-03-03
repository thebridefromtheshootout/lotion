import { parseFrontmatter, buildFrontmatter, FMField } from "../editor/frontmatterEditor";

// ═══════════════════════════════════════════════════════════════════
// parseFrontmatter (frontmatterEditor)
// ═══════════════════════════════════════════════════════════════════

describe("parseFrontmatter (frontmatterEditor)", () => {
  it("returns no fields and exists=false when no frontmatter", () => {
    const result = parseFrontmatter("# Hello");
    expect(result.exists).toBe(false);
    expect(result.fields).toEqual([]);
  });

  it("parses simple key-value fields", () => {
    const text = "---\ntitle: My Page\nauthor: Jane\n---\n# Content";
    const result = parseFrontmatter(text);
    expect(result.exists).toBe(true);
    expect(result.fields).toEqual([
      { key: "title", value: "My Page" },
      { key: "author", value: "Jane" },
    ]);
  });

  it("handles empty values", () => {
    const text = "---\ntitle: \n---";
    const result = parseFrontmatter(text);
    expect(result.exists).toBe(true);
    expect(result.fields[0]).toEqual({ key: "title", value: "" });
  });

  it("handles values with colons", () => {
    const text = "---\nurl: https://example.com:8080\n---";
    const result = parseFrontmatter(text);
    expect(result.exists).toBe(true);
    expect(result.fields[0].value).toBe("https://example.com:8080");
  });

  it("handles CRLF line endings", () => {
    const text = "---\r\ntitle: Test\r\n---\r\nContent";
    const result = parseFrontmatter(text);
    expect(result.exists).toBe(true);
    expect(result.fields[0].key).toBe("title");
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildFrontmatter
// ═══════════════════════════════════════════════════════════════════

describe("buildFrontmatter", () => {
  it("returns empty string for empty fields array", () => {
    expect(buildFrontmatter([])).toBe("");
  });

  it("builds valid YAML frontmatter", () => {
    const fields: FMField[] = [
      { key: "title", value: "Hello" },
      { key: "author", value: "Jane" },
    ];
    const result = buildFrontmatter(fields);
    expect(result).toBe("---\ntitle: Hello\nauthor: Jane\n---");
  });

  it("round-trips: parse → build yields equivalent block", () => {
    const original = "---\ntitle: Test\nstatus: Draft\n---";
    const { fields } = parseFrontmatter(original + "\n# Content");
    const rebuilt = buildFrontmatter(fields);
    expect(rebuilt).toBe(original);
  });
});
