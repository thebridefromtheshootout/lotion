import { Regex } from "../core/regex";
import { escHtml } from "../core/html";

/**
 * Minimal Markdown → HTML converter.
 * Uses regex transforms for common Markdown syntax.
 * Covers: headings, bold, italic, strikethrough, highlights, code,
 * blockquotes, lists, tables, horizontal rules, links, images, and fenced code.
 */
export function markdownToHtml(md: string): string {
  let html = md;

  // ── Strip YAML front matter ───────────────────────────────────
  html = html.replace(Regex.frontmatterBlockWithTrailingNewline, "");

  // ── Fenced code blocks ────────────────────────────────────────
  html = html.replace(Regex.markdownFenceWithLangGlobal, (_match, lang: string, code: string) => {
    const langAttr = lang ? ` class="language-${escHtml(lang)}"` : "";
    return `<pre><code${langAttr}>${escHtml(code.trimEnd())}</code></pre>`;
  });

  // ── Inline code (must come before other inline transforms) ────
  html = html.replace(Regex.inlineCodeNoNewlineGlobal, "<code>$1</code>");

  // ── Headings ──────────────────────────────────────────────────
  html = html.replace(Regex.headingH6Global, "<h6>$1</h6>");
  html = html.replace(Regex.headingH5Global, "<h5>$1</h5>");
  html = html.replace(Regex.headingH4Global, "<h4>$1</h4>");
  html = html.replace(Regex.headingH3Global, "<h3>$1</h3>");
  html = html.replace(Regex.headingH2Global, "<h2>$1</h2>");
  html = html.replace(Regex.headingH1Global, "<h1>$1</h1>");

  // ── Horizontal rules ─────────────────────────────────────────
  html = html.replace(Regex.markdownHorizontalRuleGlobal, "<hr>");

  // ── Blockquotes (callout-aware) ───────────────────────────────
  html = html.replace(Regex.blockquoteBlockGlobal, (block) => {
    const inner = block.replace(Regex.calloutStripPrefixGlobal, "").trim();
    // Detect callouts: [!NOTE], [!TIP], etc.
    const calloutMatch = inner.match(Regex.calloutTokenWithText);
    if (calloutMatch) {
      const type = calloutMatch[1].toLowerCase();
      const rest = inner.replace(Regex.calloutTokenStrip, "");
      return `<div class="callout callout-${type}"><div class="callout-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div><p>${rest}</p></div>`;
    }
    return `<blockquote><p>${inner}</p></blockquote>`;
  });

  // ── Tables ────────────────────────────────────────────────────
  html = html.replace(
    Regex.markdownTableBlockGlobal,
    (_match, headerLine: string, _separatorLine: string, bodyBlock: string) => {
      const headers = headerLine
        .split("|")
        .filter((c: string) => c.trim())
        .map((c: string) => c.trim());
      const rows = bodyBlock
        .trim()
        .split(Regex.lineBreakSplit)
        .map((row: string) =>
          row
            .split("|")
            .filter((c: string) => c.trim())
            .map((c: string) => c.trim()),
        );
      let table = "<table><thead><tr>";
      for (const h of headers) {
        table += `<th>${h}</th>`;
      }
      table += "</tr></thead><tbody>";
      for (const row of rows) {
        table += "<tr>";
        for (const cell of row) {
          table += `<td>${cell}</td>`;
        }
        table += "</tr>";
      }
      table += "</tbody></table>";
      return table;
    },
  );

  // ── Task lists ────────────────────────────────────────────────
  html = html.replace(Regex.markdownTaskDoneGlobal, '<li class="task-done"><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(Regex.markdownTaskTodoGlobal, '<li class="task"><input type="checkbox" disabled> $1</li>');

  // ── Unordered lists ───────────────────────────────────────────
  html = html.replace(Regex.markdownBulletLineGlobal, "<li>$1</li>");
  html = html.replace(Regex.htmlListItemsGroupGlobal, "<ul>$1</ul>");

  // ── Ordered lists ────────────────────────────────────────────
  html = html.replace(Regex.markdownOrderedLineGlobal, "<oli>$1</oli>");
  html = html.replace(Regex.htmlOrderedItemsGroupGlobal, (_m, block: string) => {
    return "<ol>" + block.replace(Regex.htmlOliTagGlobal, (tag: string) => tag.replace("oli", "li")) + "</ol>";
  });

  // ── Inline formatting ────────────────────────────────────────
  html = html.replace(Regex.markdownBoldItalicGlobal, "<strong><em>$1</em></strong>");
  html = html.replace(Regex.markdownBoldGlobal, "<strong>$1</strong>");
  html = html.replace(Regex.markdownItalicGlobal, "<em>$1</em>");
  html = html.replace(Regex.markdownStrikeGlobal, "<del>$1</del>");
  html = html.replace(Regex.markdownHighlightGlobal, "<mark>$1</mark>");

  // ── Images ────────────────────────────────────────────────────
  html = html.replace(Regex.markdownImageGlobal, '<img src="$2" alt="$1" style="max-width:100%">');

  // ── Links ─────────────────────────────────────────────────────
  html = html.replace(Regex.markdownLinkGlobal, '<a href="$2">$1</a>');

  // ── Paragraphs (wrap remaining loose text) ────────────────────
  html = html.replace(Regex.markdownLooseParagraphGlobal, "<p>$1</p>");

  // Clean up empty paragraphs
  html = html.replace(Regex.htmlEmptyParagraphGlobal, "");

  return html;
}
