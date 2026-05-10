import { decodeHtmlEntities, deriveUrlLabel, extractTitle } from "../editor/smartPaste";

describe("decodeHtmlEntities", () => {
  it("decodes named entities for the most common HTML names", () => {
    expect(decodeHtmlEntities("&amp;")).toBe("&");
    expect(decodeHtmlEntities("a &lt; b")).toBe("a < b");
    expect(decodeHtmlEntities("&quot;hi&quot;")).toBe('"hi"');
    expect(decodeHtmlEntities("&apos;ok&apos;")).toBe("'ok'");
    expect(decodeHtmlEntities("a &nbsp; b")).toBe("a   b");
    expect(decodeHtmlEntities("end&hellip;")).toBe("end…");
    expect(decodeHtmlEntities("a &mdash; b")).toBe("a — b");
  });

  it("decodes numeric (decimal) entities", () => {
    expect(decodeHtmlEntities("&#65;&#66;&#67;")).toBe("ABC");
    expect(decodeHtmlEntities("smile &#9786;")).toBe("smile ☺");
  });

  it("decodes hex entities (#x...)", () => {
    expect(decodeHtmlEntities("&#x41;&#x42;")).toBe("AB");
    expect(decodeHtmlEntities("&#x263A;")).toBe("☺");
  });

  it("leaves unknown named entities untouched", () => {
    expect(decodeHtmlEntities("&unknown;")).toBe("&unknown;");
  });

  it("preserves non-entity text", () => {
    expect(decodeHtmlEntities("plain text")).toBe("plain text");
    expect(decodeHtmlEntities("a & b without semicolon")).toBe("a & b without semicolon");
  });
});

describe("extractTitle", () => {
  it("prefers og:title over <title>", () => {
    const html = `
      <head>
        <meta property="og:title" content="OG Title" />
        <title>Generic Title</title>
      </head>`;
    expect(extractTitle(html)).toBe("OG Title");
  });

  it("falls back to <title> when og:title is missing", () => {
    const html = "<head><title>Just a title</title></head>";
    expect(extractTitle(html)).toBe("Just a title");
  });

  it("decodes HTML entities in extracted titles", () => {
    expect(extractTitle("<title>A &amp; B</title>")).toBe("A & B");
  });

  it("matches og:title in either attribute order", () => {
    const reverseOrder = `<meta content="Reversed" property="og:title">`;
    expect(extractTitle(reverseOrder)).toBe("Reversed");
  });

  it("returns undefined when neither tag is present", () => {
    expect(extractTitle("<html><body>nothing here</body></html>")).toBeUndefined();
  });

  it("strips GitHub's ' at branch · user/repo' suffix when url is github.com", () => {
    const html = "<title>lotion/src/foo at master · user/repo</title>";
    expect(extractTitle(html, new URL("https://github.com/user/repo/tree/master/src/foo"))).toBe(
      "lotion/src/foo",
    );
  });
});

describe("deriveUrlLabel", () => {
  it("renders github.com/user/repo as user/repo", () => {
    expect(deriveUrlLabel(new URL("https://github.com/anthropics/claude-code"))).toBe("anthropics/claude-code");
  });

  it("renders github.com/user/repo/tree/branch/path as repo/path", () => {
    expect(deriveUrlLabel(new URL("https://github.com/user/repo/tree/main/src/foo"))).toBe("repo/src/foo");
  });

  it("renders github.com/user/repo/issues/42 as repo#42", () => {
    expect(deriveUrlLabel(new URL("https://github.com/user/repo/issues/42"))).toBe("repo#42");
  });

  it("renders github.com/user/repo/pull/7 as repo#7", () => {
    expect(deriveUrlLabel(new URL("https://github.com/user/repo/pull/7"))).toBe("repo#7");
  });

  it("uses the brand name for known sites", () => {
    expect(deriveUrlLabel(new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))).toBe("YouTube");
    expect(deriveUrlLabel(new URL("https://x.com/user/status/123"))).toBe("X");
    expect(deriveUrlLabel(new URL("https://stackoverflow.com/questions/1"))).toBe("Stack Overflow");
  });
});
