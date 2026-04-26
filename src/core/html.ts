import { Regex } from "./regex";

export function escHtml(s: string): string {
  return s
    .replace(Regex.htmlEscapeAmp, "&amp;")
    .replace(Regex.htmlEscapeLt, "&lt;")
    .replace(Regex.htmlEscapeGt, "&gt;")
    .replace(Regex.htmlEscapeQuote, "&quot;");
}
