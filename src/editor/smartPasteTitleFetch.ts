import * as https from "https";
import * as http from "http";
import { Regex } from "../core/regex";

// ── Title-fetching constants ───────────────────────────────────────

const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_TITLE_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const HTML_TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;
const HTML_ENTITY_RE = /&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi;

const ENTITY_MAP: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
};

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_REDIRECTS = 5;

// ── HTML entity decoding ───────────────────────────────────────────

/** Exported for unit tests. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (_, dec, hex, named) => {
    if (dec) return String.fromCharCode(parseInt(dec, 10));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    return ENTITY_MAP[named] ?? _;
  });
}

// ── oEmbed: lightweight JSON API exposed by sites for link previewing ──

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

// ── HTML <title> scraping with redirects ───────────────────────────

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

// ── Title extraction + cleanup ─────────────────────────────────────

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

/** Exported for unit tests. */
export function extractTitle(html: string, url?: URL): string | undefined {
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
