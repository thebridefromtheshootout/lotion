
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Regex } from "../core/regex";
import { clipboardHasImage, imageFromClipboard } from "../media/clipboard";
import { cursorInCodeContext } from "./codeContext";

// ── Smart paste (Ctrl+V with link & image detection) ──────────────
export async function handleSmartPaste() {
  if (!hostEditor.isMarkdownEditor()) {
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }
  const document = hostEditor.getDocument();
  const cursor = hostEditor.getCursorPosition();
  if (document && cursor && cursorInCodeContext(document, cursor)) {
    // Preserve literal paste behavior while editing code snippets/blocks.
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }
  const selection = hostEditor.getSelection()!;

  // ── Link-wrap: selected text + URL on clipboard → [text](url) ──
  if (!selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    if (Regex.httpUrl.test(clipText)) {
      const selectedText = hostEditor.getDocumentText(selection);
      await hostEditor.replaceCurrentSelection(`[${selectedText}](${clipText})`);
      return;
    }
  }

  // ── Auto-link: no selection + bare URL on clipboard → [host](url) ──
  if (selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    if (Regex.httpUrl.test(clipText)) {
      try {
        const url = new URL(clipText);
        // Derive a readable label from the URL
        const label = deriveUrlLabel(url);
        await hostEditor.insertAtCursor(`[${label}](${clipText})`);
        return;
      } catch {
        // Malformed URL — fall through to normal paste
      }
    }
  }

  // ── Table paste: TSV/CSV clipboard → markdown table ────────────
  if (selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    const tableResult = tryParseTableData(clipText);
    if (tableResult) {
      await hostEditor.insertAtCursor(tableResult);
      return;
    }
  }

  // ── Image paste: clipboard image → save & insert ───────────────
  const cwd = getCwd();
  if (!cwd || !clipboardHasImage()) {
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }

  const rsrcDir = path.join(cwd, ".rsrc");
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
  }

  const defaultName = new Date().toISOString().replace(/[:.]/g, "-");
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
    return;
  }

  const savedFileName = await imageFromClipboard(rsrcDir, imageName);
  if (!savedFileName) {
    return;
  }

  const relativePath = `.rsrc/${savedFileName}`;
  const escapedAlt = imageName.replace(/"/g, "&quot;");
  const imgTag = `<img src="${relativePath}" alt="${escapedAlt}">`;
  if (selection.isEmpty) {
    await hostEditor.insertAtCursor(imgTag);
  } else {
    await hostEditor.replaceCurrentSelection(imgTag);
  }
  await hostEditor.saveActiveDocument();
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Derive a human-readable label from a URL.
 *
 * - GitHub:   "github.com/user/repo" → "user/repo"
 * - YouTube:  → "YouTube"
 * - Docs:     "/path/to/page" → "Page"
 * - Fallback: hostname without www
 */
function deriveUrlLabel(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");

  // GitHub: show user/repo
  if (host === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
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
    const last = pathParts[pathParts.length - 1].replace(/[-_]/g, " ").replace(/\.\w+$/, ""); // strip file extension
    if (last.length > 0 && last.length < 60) {
      // Title-case it
      const titled = last.replace(/\b\w/g, (c) => c.toUpperCase());
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
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return undefined;
  }

  // Check for tab-separated
  const tabCounts = lines.map((l) => (l.match(/\t/g) || []).length);
  const allSameTabCount = tabCounts.every((c) => c === tabCounts[0] && c >= 1);

  if (allSameTabCount) {
    return toMarkdownTable(lines.map((l) => l.split("\t").map((c) => c.trim())));
  }

  // Check for CSV (at least 2 commas per line, consistent count)
  const commaCounts = lines.map((l) => (l.match(/,/g) || []).length);
  const allSameCommaCount = commaCounts.every((c) => c === commaCounts[0] && c >= 1);

  if (allSameCommaCount) {
    return toMarkdownTable(lines.map((l) => parseCSVLine(l)));
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

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  cells.push(current.trim());
  return cells;
}
