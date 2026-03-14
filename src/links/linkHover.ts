import { hostEditor } from "../hostEditor/HostingEditor";
import { Disposable, Hover, MarkdownString, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import * as path from "path";
import * as fs from "fs";
import { Regex } from "../core/regex";

/**
 * Link tooltip hover provider.
 *
 * When hovering over a markdown link `[text](target)`, shows a preview
 * containing the target page's title (first H1 or filename) and its
 * first non-empty paragraph.
 */
export function createLinkHoverProvider(): Disposable {
  return hostEditor.registerHoverProvider({ language: "markdown", scheme: "file" }, { provideHover });
}

const LINK_RE = Regex.markdownLinkGlobal;

async function provideHover(doc: TextDocument, pos: Position): Promise<Hover | undefined> {
  const line = doc.lineAt(pos.line).text;
  let match: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (pos.character < start || pos.character > end) {
      continue;
    }

    // Skip image links (preceded by `!`)
    if (start > 0 && line[start - 1] === "!") {
      continue;
    }

    const target = match[2];
    // Skip external / anchor-only links
    if (Regex.httpOrMailtoOrAnchor.test(target)) {
      continue;
    }

    const targetPath = resolveLink(doc, target);
    if (!targetPath) {
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(targetPath, "utf-8");
    } catch {
      return new Hover(new MarkdownString(`*File not found:* \`${target}\``));
    }

    const title = extractTitle(content, targetPath);
    const summary = extractSummary(content);
    const wordCount = content.split(Regex.wordSplit).filter(Boolean).length;

    const md = new MarkdownString();
    md.appendMarkdown(`### ${title}\n\n`);
    if (summary) {
      md.appendMarkdown(`${summary}\n\n`);
    }
    md.appendMarkdown(`---\n*${wordCount} words*`);
    md.isTrusted = true;

    return new Hover(md, new Range(pos.line, start, pos.line, end));
  }
  return undefined;
}

function resolveLink(doc: TextDocument, target: string): string | undefined {
  // Strip fragment
  const clean = target.split("#")[0];
  if (!clean) {
    return undefined;
  }

  const dir = path.dirname(doc.uri.fsPath);
  const resolved = path.resolve(dir, clean);

  // Try as-is, then with .md
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const idx = path.join(resolved, "index.md");
      return fs.existsSync(idx) ? idx : undefined;
    }
    return resolved;
  }
  const withMd = resolved + ".md";
  if (fs.existsSync(withMd)) {
    return withMd;
  }
  return undefined;
}

function extractTitle(content: string, filePath: string): string {
  // Check frontmatter title
  const fmMatch = content.match(Regex.frontmatterBlock);
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(Regex.frontmatterTitleLine);
    if (titleMatch) {
      return titleMatch[1].trim().replace(Regex.quotedStringEdges, "");
    }
  }

  // Check first H1
  const h1 = content.match(Regex.headingH1Multiline);
  if (h1) {
    return h1[1].trim();
  }

  // Fallback to filename
  return path.basename(filePath, ".md");
}

function extractSummary(content: string): string {
  const lines = content.split(Regex.lineBreakSplit);
  let inFrontmatter = false;
  let pastFrontmatter = false;
  const paragraphLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === "---" && !pastFrontmatter) {
      if (inFrontmatter) {
        pastFrontmatter = true;
        inFrontmatter = false;
        continue;
      }
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      continue;
    }

    // Skip headings
    if (Regex.headingPrefix.test(line)) {
      continue;
    }

    // Skip empty lines before first paragraph
    if (!line.trim() && paragraphLines.length === 0) {
      continue;
    }

    // End of paragraph
    if (!line.trim() && paragraphLines.length > 0) {
      break;
    }

    paragraphLines.push(line.trim());
  }

  const summary = paragraphLines.join(" ").substring(0, 300);
  return summary.length === 300 ? summary + "…" : summary;
}
