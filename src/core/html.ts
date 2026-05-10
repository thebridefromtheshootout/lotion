// Single-pass HTML escaper. Replaces `&`, `<`, `>`, `"` in one walk
// instead of the previous four sequential regex replacements.
const HTML_ESC_RE = /[&<>"]/g;
const HTML_ESC_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function escHtml(s: string): string {
  return s.replace(HTML_ESC_RE, (ch) => HTML_ESC_MAP[ch]);
}
