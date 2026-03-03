import { markdownToHtml, escHtml } from "../media/pdfExport";

// ═══════════════════════════════════════════════════════════════════
// escHtml
// ═══════════════════════════════════════════════════════════════════

describe("escHtml", () => {
  it("escapes ampersands", () => {
    expect(escHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("handles empty string", () => {
    expect(escHtml("")).toBe("");
  });

  it("handles multiple special chars together", () => {
    expect(escHtml('<a href="x" & y>')).toBe("&lt;a href=&quot;x&quot; &amp; y&gt;");
  });
});

// ═══════════════════════════════════════════════════════════════════
// markdownToHtml
// ═══════════════════════════════════════════════════════════════════

describe("markdownToHtml", () => {
  // ── Headings ──

  it("converts H1–H6 headings", () => {
    expect(markdownToHtml("# Heading 1")).toContain("<h1>Heading 1</h1>");
    expect(markdownToHtml("## Heading 2")).toContain("<h2>Heading 2</h2>");
    expect(markdownToHtml("### Heading 3")).toContain("<h3>Heading 3</h3>");
    expect(markdownToHtml("#### Heading 4")).toContain("<h4>Heading 4</h4>");
    expect(markdownToHtml("##### Heading 5")).toContain("<h5>Heading 5</h5>");
    expect(markdownToHtml("###### Heading 6")).toContain("<h6>Heading 6</h6>");
  });

  // ── Inline formatting ──

  it("converts bold text", () => {
    expect(markdownToHtml("**bold**")).toContain("<strong>bold</strong>");
  });

  it("converts italic text", () => {
    expect(markdownToHtml("*italic*")).toContain("<em>italic</em>");
  });

  it("converts bold-italic text", () => {
    const result = markdownToHtml("***bold-italic***");
    expect(result).toContain("<strong><em>bold-italic</em></strong>");
  });

  it("converts strikethrough text", () => {
    expect(markdownToHtml("~~deleted~~")).toContain("<del>deleted</del>");
  });

  it("converts highlighted text", () => {
    expect(markdownToHtml("==highlight==")).toContain("<mark>highlight</mark>");
  });

  it("converts inline code", () => {
    expect(markdownToHtml("`code`")).toContain("<code>code</code>");
  });

  // ── Links & images ──

  it("converts links", () => {
    expect(markdownToHtml("[text](url)")).toContain('<a href="url">text</a>');
  });

  it("converts images", () => {
    const result = markdownToHtml("![alt](img.png)");
    expect(result).toContain('<img src="img.png" alt="alt"');
  });

  // ── Lists ──

  it("converts unordered list items", () => {
    const result = markdownToHtml("- Item 1\n- Item 2");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Item 1</li>");
    expect(result).toContain("<li>Item 2</li>");
    expect(result).toContain("</ul>");
  });

  it("converts task lists", () => {
    const result = markdownToHtml("- [x] Done\n- [ ] Not done");
    expect(result).toContain("checked");
    expect(result).toContain("Not done");
  });

  // ── Code blocks ──

  it("converts fenced code blocks", () => {
    const md = "```js\nconsole.log('hi');\n```";
    const result = markdownToHtml(md);
    expect(result).toContain("<pre><code");
    expect(result).toContain("language-js");
    expect(result).toContain("console.log(");
  });

  it("escapes HTML inside code blocks", () => {
    const md = "```\n<div>test</div>\n```";
    const result = markdownToHtml(md);
    expect(result).toContain("&lt;div&gt;");
  });

  // ── Tables ──

  it("converts tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const result = markdownToHtml(md);
    expect(result).toContain("<table>");
    expect(result).toContain("<th>A</th>");
    expect(result).toContain("<td>1</td>");
  });

  // ── Blockquotes & callouts ──

  it("converts blockquotes", () => {
    const result = markdownToHtml("> Quote text");
    expect(result).toContain("<blockquote>");
  });

  it("converts callout blocks", () => {
    const result = markdownToHtml("> [!NOTE] Important info");
    expect(result).toContain("callout-note");
    expect(result).toContain("Note");
  });

  // ── Horizontal rules ──

  it("converts horizontal rules", () => {
    expect(markdownToHtml("---")).toContain("<hr>");
  });

  // ── Frontmatter stripping ──

  it("strips YAML frontmatter", () => {
    const md = "---\ntitle: Test\n---\n# Content";
    const result = markdownToHtml(md);
    expect(result).not.toContain("title: Test");
    expect(result).toContain("<h1>Content</h1>");
  });
});
