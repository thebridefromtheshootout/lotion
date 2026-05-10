import * as path from "path";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { escHtml } from "../core/html";
import { fetchPageTitle } from "./smartPasteTitleFetch";

// ── Anchor builder ─────────────────────────────────────────────────

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
  return text.slice(0, max - 1) + "…";
}

// ── Image-URL detection ────────────────────────────────────────────

const IMAGE_URL_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"]);

export function isImageUrl(url: URL): boolean {
  return IMAGE_URL_EXTS.has(path.extname(url.pathname).toLowerCase());
}

export function deriveImageAlt(url: URL): string {
  const file = path.basename(url.pathname);
  const base = file ? file.replace(Regex.fileExtensionSuffix, "") : "";
  if (!base) {
    return "image";
  }
  return base
    .replace(Regex.dashUnderscore, " ")
    .replace(Regex.wordBoundaryChar, (c) => c.toUpperCase());
}

// ── URL → human label ──────────────────────────────────────────────

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
