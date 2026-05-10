
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { getCwd } from "../core/cwd";
import { Regex } from "../core/regex";
import { escHtml } from "../core/html";
import { parseCsvLine } from "../core/csv";
import { probeClipboardImage, imageFromClipboard } from "../media/clipboard";
import { cursorInCodeContext } from "./codeContext";

const SMART_PASTE_LOG_PREFIX = "[Lotion][smartPaste]";
const shownClipboardDependencyErrors = new Set<string>();

/**
 * Smart-paste tracing fires on every Ctrl+V. Only emit when the user has
 * explicitly opted in via `lotion.smartPaste.debug`; otherwise the log
 * stream pollutes the dev console for everyone.
 */
function logSmartPaste(step: string, details?: Record<string, unknown>): void {
  if (!hostEditor.getConfiguration("lotion").get<boolean>("smartPaste.debug", false)) {
    return;
  }
  if (details) {
    console.log(`${SMART_PASTE_LOG_PREFIX} ${step}`, details);
  } else {
    console.log(`${SMART_PASTE_LOG_PREFIX} ${step}`);
  }
}

// ── Smart paste (Ctrl+V with link & image detection) ──────────────
export async function handleSmartPaste() {
  logSmartPaste("start");
  if (!hostEditor.isMarkdownEditor()) {
    logSmartPaste("not-markdown-editor -> default-paste");
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }
  const document = hostEditor.getDocument();
  const cursor = hostEditor.getCursorPosition();
  if (document && cursor && cursorInCodeContext(document, cursor)) {
    logSmartPaste("cursor-in-code-context -> default-paste");
    // Preserve literal paste behavior while editing code snippets/blocks.
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }
  const selection = hostEditor.getSelection()!;
  logSmartPaste("selection-state", { isEmpty: selection.isEmpty });

  // ── Link-wrap: selected text + URL on clipboard → HTML link/image ──
  if (!selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    logSmartPaste("selection+clipboard", { clipboardLength: clipText.length, looksLikeUrl: Regex.httpUrl.test(clipText) });
    if (Regex.httpUrl.test(clipText)) {
      try {
        const url = new URL(clipText);
        const hrefOrSrc = escHtml(clipText);
        const selectedText = hostEditor.getDocumentText(selection).trim();
        if (isImageUrl(url)) {
          logSmartPaste("selected-url->html-image");
          const alt = escHtml(selectedText || deriveImageAlt(url));
          await hostEditor.replaceCurrentSelection(`<img src="${hrefOrSrc}" alt="${alt}">`);
        } else {
          logSmartPaste("selected-url->html-anchor");
          await hostEditor.replaceCurrentSelection(await buildAnchorTag(clipText, selectedText || undefined));
        }
        return;
      } catch {
        logSmartPaste("selected-url-parse-failed -> continue");
        // Malformed URL — fall through to normal paste
      }
    }
  }

  // ── Auto-link: no selection + bare URL on clipboard → HTML link/image ──
  if (selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    logSmartPaste("empty-selection+clipboard", { clipboardLength: clipText.length, looksLikeUrl: Regex.httpUrl.test(clipText) });
    if (Regex.httpUrl.test(clipText)) {
      try {
        const url = new URL(clipText);
        const hrefOrSrc = escHtml(clipText);
        if (isImageUrl(url)) {
          logSmartPaste("auto-url->html-image");
          const alt = escHtml(deriveImageAlt(url));
          await hostEditor.insertAtCursor(`<img src="${hrefOrSrc}" alt="${alt}">`);
        } else {
          logSmartPaste("auto-url->html-anchor");
          await hostEditor.insertAtCursor(await buildAnchorTag(clipText));
        }
        return;
      } catch {
        logSmartPaste("auto-url-parse-failed -> continue");
        // Malformed URL — fall through to normal paste
      }
    }
  }

  // ── Table paste: TSV/CSV clipboard → markdown table ────────────
  if (selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    const tableResult = tryParseTableData(clipText);
    if (tableResult) {
      logSmartPaste("table-detected->insert-markdown-table");
      await hostEditor.insertAtCursor(tableResult);
      return;
    }
    logSmartPaste("table-not-detected");
  }

  // ── Image paste: clipboard image → save & insert ───────────────
  const cwd = getCwd();
  const clipProbe = probeClipboardImage();
  logSmartPaste("image-path-check", { hasCwd: !!cwd, hasClipboardImage: clipProbe.hasImage });
  if (!cwd || !clipProbe.hasImage) {
    if (clipProbe.missingDependencyMessage && !shownClipboardDependencyErrors.has(clipProbe.missingDependencyMessage)) {
      shownClipboardDependencyErrors.add(clipProbe.missingDependencyMessage);
      await hostEditor.showError(clipProbe.missingDependencyMessage);
    }
    logSmartPaste("image-path-bypass -> default-paste");
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }

  const rsrcDir = path.join(cwd, ".rsrc");
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
    logSmartPaste("created-rsrc-dir", { rsrcDir });
  }

  const defaultName = new Date().toISOString().replace(Regex.colonDot, "-");
  const imageName = await hostEditor.showInputBox({
    prompt: "Name for the image (without extension)",
    value: defaultName,
    valueSelection: [0, defaultName.length],
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Image name cannot be empty";
      }
      if (Regex.invalidPathChars.test(value)) {
        return "Image name contains invalid characters";
      }
      return undefined;
    },
  });

  if (!imageName) {
    logSmartPaste("image-name-cancelled");
    return;
  }
  logSmartPaste("image-name-confirmed", { imageName });

  const savedFileName = await imageFromClipboard(rsrcDir, imageName);
  if (!savedFileName) {
    logSmartPaste("image-save-failed");
    return;
  }
  logSmartPaste("image-saved", { savedFileName });

  const relativePath = `.rsrc/${savedFileName}`;
  const escapedAlt = imageName.replace(Regex.doubleQuote, "&quot;");
  const imgTag = `<img src="${relativePath}" alt="${escapedAlt}">`;
  if (selection.isEmpty) {
    logSmartPaste("insert-local-image-at-cursor");
    await hostEditor.insertAtCursor(imgTag);
  } else {
    logSmartPaste("replace-selection-with-local-image");
    await hostEditor.replaceCurrentSelection(imgTag);
  }
  await hostEditor.saveActiveDocument();
  logSmartPaste("done");
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Build an `<a href="...">label</a>` tag for a URL.
 * Fetches the page title, falls back to URL-derived label, truncates, and escapes.
 * An optional `labelOverride` skips fetching and uses that text instead.
 */
export async function buildAnchorTag(urlStr: string, labelOverride?: string): Promise<string> {
  const href = escHtml(urlStr);
  let label: string;
  if (labelOverride) {
    label = labelOverride;
  } else {
    try {
      const url = new URL(urlStr);
      label = (await fetchPageTitle(url)) || deriveUrlLabel(url);
    } catch {
      label = urlStr;
    }
  }
  return `<a href="${href}">${escHtml(truncateLabel(label))}</a>`;
}

export function truncateLabel(text: string): string {
  const max = hostEditor.getConfiguration("lotion").get<number>("smartPasteLinkLabelMaxLength", 30);
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

const IMAGE_URL_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"]);

function isImageUrl(url: URL): boolean {
  return IMAGE_URL_EXTS.has(path.extname(url.pathname).toLowerCase());
}

function deriveImageAlt(url: URL): string {
  const file = path.basename(url.pathname);
  const base = file ? file.replace(Regex.fileExtensionSuffix, "") : "";
  if (!base) {
    return "image";
  }
  return base
    .replace(Regex.dashUnderscore, " ")
    .replace(Regex.wordBoundaryChar, (c) => c.toUpperCase());
}

const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_TITLE_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const HTML_TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;
const HTML_ENTITY_RE = /&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi;

const ENTITY_MAP: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (_, dec, hex, named) => {
    if (dec) return String.fromCharCode(parseInt(dec, 10));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    return ENTITY_MAP[named] ?? _;
  });
}

/**
 * Fetch a URL and extract the page title from og:title or <title>.
 * Reads at most 16 KB with a 4-second timeout. Returns undefined on failure.
 */
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_REDIRECTS = 5;

// ── oEmbed: lightweight JSON API that sites expose for link previewing ──
const OEMBED_ENDPOINTS: [test: (host: string) => boolean, endpoint: string][] = [
  [h => h === "reddit.com" || h.endsWith(".reddit.com"), "https://www.reddit.com/oembed"],
  [h => h === "youtube.com" || h === "youtu.be" || h.endsWith(".youtube.com"), "https://www.youtube.com/oembed"],
  [h => h === "twitter.com" || h === "x.com", "https://publish.twitter.com/oembed"],
  [h => h === "vimeo.com" || h.endsWith(".vimeo.com"), "https://vimeo.com/api/oembed.json"],
  [h => h === "flickr.com" || h.endsWith(".flickr.com"), "https://www.flickr.com/services/oembed"],
  [h => h === "spotify.com" || h.endsWith(".spotify.com"), "https://open.spotify.com/oembed"],
  [h => h === "soundcloud.com" || h.endsWith(".soundcloud.com"), "https://soundcloud.com/oembed"],
  [h => h === "tiktok.com" || h.endsWith(".tiktok.com"), "https://www.tiktok.com/oembed"],
];

function findOembedEndpoint(url: URL): string | undefined {
  const host = url.hostname.replace(Regex.urlWwwPrefix, "");
  for (const [test, endpoint] of OEMBED_ENDPOINTS) {
    if (test(host)) return endpoint;
  }
  return undefined;
}

function fetchOembedTitle(url: URL): Promise<string | undefined> {
  const endpoint = findOembedEndpoint(url);
  if (!endpoint) return Promise.resolve(undefined);

  const oembedUrl = `${endpoint}?url=${encodeURIComponent(url.href)}&format=json`;
  return fetchJson(new URL(oembedUrl)).then(json => {
    if (json && typeof json.title === "string" && json.title.trim().length > 0) {
      return json.title.trim();
    }
    return undefined;
  }).catch(() => undefined);
}

function fetchJson(url: URL): Promise<any> {
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const req = client.get(url, { timeout: 4000, headers: { "User-Agent": BROWSER_UA, "Accept": "application/json" } }, (res) => {
      if (res.statusCode && res.statusCode >= 400) { req.destroy(); resolve(undefined); return; }

      let buf = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => { buf += chunk; if (buf.length > 32768) { req.destroy(); } });
      res.on("end", () => { try { resolve(JSON.parse(buf)); } catch { resolve(undefined); } });
      res.on("error", () => resolve(undefined));
    });
    req.on("timeout", () => { req.destroy(); resolve(undefined); });
    req.on("error", () => resolve(undefined));
  });
}

/**
 * Best-effort title lookup for a URL. Tries oEmbed first (cheap JSON, no
 * bot-blocking), then falls back to scraping the page's `<title>` tag.
 * Returns `undefined` if both paths fail (offline, 404, slow host, …) —
 * callers should treat the missing title as a non-fatal degradation.
 */
export async function fetchPageTitle(url: URL): Promise<string | undefined> {
  const oembedTitle = await fetchOembedTitle(url);
  if (oembedTitle) return oembedTitle;
  return fetchHtmlTitle(url);
}

function fetchHtmlTitle(url: URL, redirectsLeft = MAX_REDIRECTS): Promise<string | undefined> {
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const req = client.get(url, { timeout: 4000, headers: { "User-Agent": BROWSER_UA, "Accept": "text/html" } }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        if (redirectsLeft <= 0) { resolve(undefined); return; }
        try {
          const redirectUrl = new URL(res.headers.location, url);
          fetchHtmlTitle(redirectUrl, redirectsLeft - 1).then(resolve);
        } catch {
          resolve(undefined);
        }
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        req.destroy();
        resolve(undefined);
        return;
      }

      let buf = "";
      let resolved = false;
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => {
        buf += chunk;
        if (buf.length > 16384) {
          resolved = true;
          resolve(extractTitle(buf, url));
          req.destroy();
        }
      });
      res.on("end", () => { if (!resolved) { resolved = true; resolve(extractTitle(buf, url)); } });
      res.on("close", () => { if (!resolved) { resolved = true; resolve(extractTitle(buf, url)); } });
      res.on("error", () => { if (!resolved) { resolved = true; resolve(undefined); } });
    });

    req.on("timeout", () => { req.destroy(); resolve(undefined); });
    req.on("error", () => resolve(undefined));
  });
}

/** Strip boilerplate suffixes that sites append to page titles. */
const TITLE_SUFFIX_PATTERNS = [
  / · GitHub$/,            // "lotion/src at master · user/repo · GitHub" → strip " · GitHub"
  / - YouTube$/,
  / \| Reddit$/,
  / on X$/,
];

function cleanTitle(raw: string, url: URL): string {
  let title = raw;
  for (const pat of TITLE_SUFFIX_PATTERNS) {
    title = title.replace(pat, "");
  }
  // GitHub: "lotion/src/communicators at master · user/repo" → "lotion/src/communicators"
  if (url.hostname.endsWith("github.com")) {
    title = title.replace(/ at [^\s]+ · .+$/, "");
  }
  return title.trim() || raw;
}

function extractTitle(html: string, url?: URL): string | undefined {
  let raw: string | undefined;
  // Prefer og:title
  const og = html.match(OG_TITLE_RE) ?? html.match(OG_TITLE_RE_ALT);
  if (og?.[1]) {
    const decoded = decodeHtmlEntities(og[1]).trim();
    if (decoded.length > 0) raw = decoded;
  }
  // Fall back to <title>
  if (!raw) {
    const title = html.match(HTML_TITLE_RE);
    if (title?.[1]) {
      const decoded = decodeHtmlEntities(title[1]).trim();
      if (decoded.length > 0) raw = decoded;
    }
  }
  if (!raw) return undefined;
  return url ? cleanTitle(raw, url) : raw;
}

/**
 * Derive a human-readable label from a URL.
 *
 * - GitHub:   "github.com/user/repo" → "user/repo"
 * - YouTube:  → "YouTube"
 * - Docs:     "/path/to/page" → "Page"
 * - Fallback: hostname without www
 */
export function deriveUrlLabel(url: URL): string {
  const host = url.hostname.replace(Regex.urlWwwPrefix, "");

  // GitHub: show contextual path
  // /user/repo                           → "user/repo"
  // /user/repo/tree/branch/src/foo       → "repo/src/foo"
  // /user/repo/blob/branch/src/foo.ts    → "repo/src/foo.ts"
  // /user/repo/issues/42                 → "repo#42"
  // /user/repo/pull/7                    → "repo#7"
  if (host === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const repo = parts[1];
      // tree/blob: skip "tree|blob/branch" and show repo + path
      if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
        const filePath = parts.slice(4).join("/");
        return filePath ? `${repo}/${filePath}` : `${parts[0]}/${repo}`;
      }
      // issues/pull: show repo#number
      if (parts.length >= 3 && (parts[2] === "issues" || parts[2] === "pull") && parts[3]) {
        return `${repo}#${parts[3]}`;
      }
      return `${parts[0]}/${repo}`;
    }
  }

  // Well-known sites: just use the brand name
  const brands: Record<string, string> = {
    "youtube.com": "YouTube",
    "twitter.com": "Twitter",
    "x.com": "X",
    "stackoverflow.com": "Stack Overflow",
    "reddit.com": "Reddit",
    "medium.com": "Medium",
    "dev.to": "DEV",
    "npmjs.com": "npm",
    "wikipedia.org": "Wikipedia",
  };

  // Check exact match and suffix match (for subdomains like en.wikipedia.org)
  for (const [domain, brand] of Object.entries(brands)) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return brand;
    }
  }

  // If the path has a meaningful last segment, use it
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length > 0) {
    const last = pathParts[pathParts.length - 1].replace(Regex.dashUnderscore, " ").replace(Regex.fileExtensionSuffix, ""); // strip file extension
    if (last.length > 0 && last.length < 60) {
      // Title-case it
      const titled = last.replace(Regex.wordBoundaryChar, (c) => c.toUpperCase());
      return titled;
    }
  }

  return host;
}

// ── Table data detection (TSV / CSV) ─────────────────────────────

/**
 * Try to interpret clipboard text as tab-separated or CSV data.
 * Returns a markdown table string, or undefined if not tabular.
 */
function tryParseTableData(text: string): string | undefined {
  const lines = text.split(Regex.lineBreakSplit).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return undefined;
  }

  // Check for tab-separated
  const tabCounts = lines.map((l) => (l.match(Regex.tabGlobal) || []).length);
  const allSameTabCount = tabCounts.every((c) => c === tabCounts[0] && c >= 1);

  if (allSameTabCount) {
    return toMarkdownTable(lines.map((l) => l.split("\t").map((c) => c.trim())));
  }

  // Check for CSV (at least 2 commas per line, consistent count)
  const commaCounts = lines.map((l) => (l.match(Regex.commaGlobal) || []).length);
  const allSameCommaCount = commaCounts.every((c) => c === commaCounts[0] && c >= 1);

  if (allSameCommaCount) {
    return toMarkdownTable(lines.map((l) => parseCsvLine(l)));
  }

  return undefined;
}

function toMarkdownTable(rows: string[][]): string {
  if (rows.length < 1) {
    return "";
  }

  const cols = Math.max(...rows.map((r) => r.length));
  const normalised = rows.map((r) => {
    while (r.length < cols) {
      r.push("");
    }
    return r;
  });

  const widths = Array.from({ length: cols }, (_, i) => Math.max(3, ...normalised.map((r) => r[i].length)));

  const pad = (s: string, w: number) => s.padEnd(w);
  const header = "| " + normalised[0].map((c, i) => pad(c, widths[i])).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const body = normalised.slice(1).map((row) => "| " + row.map((c, i) => pad(c, widths[i])).join(" | ") + " |");

  return [header, sep, ...body].join("\n");
}

