import { escHtml } from "../core/html";

/** Build a full self-contained HTML document with print-optimized CSS. */
export function buildExportHtml(title: string, bodyHtml: string): string {
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
