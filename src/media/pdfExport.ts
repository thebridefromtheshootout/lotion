import { Uri } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";

export const EXPORT_SLASH_COMMAND: SlashCommand = {
  label: "/export",
  insertText: "",
  detail: "📄 Export page to PDF / HTML",
  isAction: true,
  commandId: Cmd.exportToPdf,
  kind: 2,
  handler: exportToPdf,
};

// ── PDF / HTML Export ──────────────────────────────────────────────
//
// Renders the current Markdown document to a self-contained, beautifully
// styled HTML file suitable for printing to PDF (Ctrl+P in any browser).
// Offers three export paths:
//   1. Open in browser → user prints to PDF
//   2. Save as HTML file
//   3. (Future) Direct PDF when a headless renderer is available

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

export function escHtml(s: string): string {
  return s
    .replace(Regex.htmlEscapeAmp, "&amp;")
    .replace(Regex.htmlEscapeLt, "&lt;")
    .replace(Regex.htmlEscapeGt, "&gt;")
    .replace(Regex.htmlEscapeQuote, "&quot;");
}

/**
 * Build a full self-contained HTML document with print-optimized CSS.
 */
function buildExportHtml(title: string, bodyHtml: string, imageDirUri?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>
  /* ── Reset & Base ─────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: #24292e;
    background: #fff;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 32px;
  }

  /* ── Typography ───────────────────────────────── */
  h1 { font-size: 2em; border-bottom: 2px solid #e1e4e8; padding-bottom: 8px; margin-top: 32px; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #e1e4e8; padding-bottom: 6px; margin-top: 28px; }
  h3 { font-size: 1.25em; margin-top: 24px; }
  h4 { font-size: 1.1em; margin-top: 20px; }
  h5, h6 { font-size: 1em; margin-top: 16px; color: #586069; }
  h1:first-child { margin-top: 0; }
  p { margin: 8px 0; }
  a { color: #0366d6; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Code ──────────────────────────────────────── */
  code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.9em;
    background: #f6f8fa;
    padding: 2px 6px;
    border-radius: 3px;
  }
  pre {
    background: #f6f8fa;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    line-height: 1.5;
  }
  pre code { background: none; padding: 0; font-size: 13px; }

  /* ── Tables ────────────────────────────────────── */
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #dfe2e5; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) { background: #fafbfc; }

  /* ── Lists ─────────────────────────────────────── */
  ul, ol { padding-left: 28px; }
  li { margin: 4px 0; }
  li.task-done { list-style: none; margin-left: -20px; text-decoration: line-through; opacity: 0.65; }
  li.task { list-style: none; margin-left: -20px; }

  /* ── Blockquote ────────────────────────────────── */
  blockquote {
    border-left: 4px solid #dfe2e5;
    padding: 4px 16px;
    margin: 12px 0;
    color: #586069;
  }

  /* ── Callouts ──────────────────────────────────── */
  .callout {
    border-left: 4px solid #448aff;
    background: rgba(68, 138, 255, 0.06);
    padding: 12px 16px;
    margin: 16px 0;
    border-radius: 4px;
  }
  .callout-title { font-weight: 600; margin-bottom: 4px; }
  .callout.callout-note { border-left-color: #448aff; background: rgba(68, 138, 255, 0.06); }
  .callout.callout-tip { border-left-color: #00c853; background: rgba(0, 200, 83, 0.06); }
  .callout.callout-warning { border-left-color: #ff9100; background: rgba(255, 145, 0, 0.06); }
  .callout.callout-important { border-left-color: #aa00ff; background: rgba(170, 0, 255, 0.06); }
  .callout.callout-caution { border-left-color: #ff1744; background: rgba(255, 23, 68, 0.06); }

  /* ── Highlight ─────────────────────────────────── */
  mark { background: rgba(255, 235, 59, 0.45); padding: 1px 4px; border-radius: 2px; }

  /* ── Images ────────────────────────────────────── */
  img { max-width: 100%; border-radius: 4px; margin: 8px 0; }

  /* ── Horizontal rule ───────────────────────────── */
  hr { border: none; border-top: 2px solid #e1e4e8; margin: 24px 0; }

  /* ── Details/toggle ────────────────────────────── */
  details { border: 1px solid #e1e4e8; border-radius: 4px; padding: 8px 12px; margin: 8px 0; }
  details > summary { cursor: pointer; font-weight: 600; }

  /* ── Print optimization ────────────────────────── */
  @media print {
    body { max-width: 100%; padding: 0; font-size: 12pt; }
    h1, h2, h3 { page-break-after: avoid; }
    pre, table, blockquote, img { page-break-inside: avoid; }
    a { color: #24292e; text-decoration: underline; }
    a::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #586069; }
    a[href^="#"]::after { content: ""; }

    /* Page header/footer */
    @page {
      margin: 1.5cm 2cm;
      @bottom-center { content: counter(page); }
    }
  }

  /* ── Dark mode ─────────────────────────────────── */
  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #c9d1d9; }
    h1, h2 { border-bottom-color: #30363d; }
    h5, h6 { color: #8b949e; }
    a { color: #58a6ff; }
    code { background: #161b22; color: #c9d1d9; }
    pre { background: #161b22 !important; }
    pre code { background: transparent; }
    blockquote { border-left-color: #30363d; color: #8b949e; }
    table th, table td { border-color: #30363d; }
    table th { background: rgba(128,128,128,0.15); }
    table tr:nth-child(even) { background: rgba(128,128,128,0.06); }
    hr { border-color: #30363d; }
    details { border-color: #30363d; }
    .export-meta { color: #8b949e; border-bottom-color: #30363d; }
    .callout { background: rgba(68,138,255,0.10); }
    .callout.callout-tip { background: rgba(0,200,83,0.10); }
    .callout.callout-warning { background: rgba(255,145,0,0.10); }
    .callout.callout-important { background: rgba(170,0,255,0.10); }
    .callout.callout-caution { background: rgba(255,23,68,0.10); }
    mark { background-color: rgba(255,235,59,0.20); }
    img { opacity: 0.9; }
  }

  /* ── Cover / title area ────────────────────────── */
  .export-meta {
    color: #586069;
    font-size: 0.85em;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e1e4e8;
  }
</style>
</head>
<body>
  <div class="export-meta">
    Exported from <strong>Lotion</strong> &mdash; ${escHtml(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}
  </div>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Export the currently active markdown document to HTML/PDF.
 */
export async function exportToPdf(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    hostEditor.showWarning("Lotion: open a Markdown file first.");
    return;
  }
  const doc = hostEditor.getDocument()!;
  const mdText = hostEditor.getDocumentText();
  const fileName = path.basename(doc.fileName, path.extname(doc.fileName));
  const fileDir = path.dirname(doc.uri.fsPath);

  // Extract title from first heading or filename
  const titleMatch = mdText.match(Regex.headingH1Multiline);
  const title = titleMatch ? titleMatch[1] : fileName;

  // Convert relative image paths to absolute file:// URIs for local rendering
  let htmlBody = markdownToHtml(mdText);
  htmlBody = htmlBody.replace(Regex.htmlRelativeSrcAttrGlobal, (_match, relPath: string) => {
    const absPath = path.resolve(fileDir, relPath);
    return `src="file:///${absPath.replace(Regex.windowsSlash, "/")}"`;
  });

  const fullHtml = buildExportHtml(title, htmlBody);

  // Ask user what they want to do
  const action = await hostEditor.showQuickPick(
    [
      { label: "$(browser) Open in Browser", description: "View in browser → Print to PDF (Ctrl+P)", value: "browser" },
      { label: "$(file-code) Save as HTML", description: "Save a self-contained HTML file", value: "html" },
    ],
    { placeHolder: "How would you like to export?" },
  );

  if (!action) {
    return;
  }

  if (action.value === "html") {
    const saveUri = await hostEditor.showSaveDialog({
      defaultUri: Uri.file(path.join(fileDir, `${fileName}.html`)),
      filters: { "HTML Files": ["html"] },
    });
    if (!saveUri) {
      return;
    }
    fs.writeFileSync(saveUri.fsPath, fullHtml, "utf-8");
    const openIt = await hostEditor.showInformationMessage(`Exported to ${path.basename(saveUri.fsPath)}`, [
      "Open in Browser",
      "Open in Editor",
    ]);
    if (openIt === "Open in Browser") {
      hostEditor.openExternal(saveUri);
    } else if (openIt === "Open in Editor") {
      const d = await hostEditor.openTextDocument(saveUri);
      await hostEditor.showTextDocument(d);
    }
  } else {
    // Write to temp file and open in browser
    const tmpDir = path.join(fileDir, ".lotion-export");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpFile = path.join(tmpDir, `${fileName}.html`);
    fs.writeFileSync(tmpFile, fullHtml, "utf-8");
    await hostEditor.openExternal(Uri.file(tmpFile));
    hostEditor.showInformation(`Opened "${title}" in your browser. Press Ctrl+P / ⌘P to print as PDF.`);
  }
}
