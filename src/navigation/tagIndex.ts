import { Uri } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";

// ── Tag index ──────────────────────────────────────────────────────
//
// Scans all markdown files for tags (frontmatter `tags: [...]` or
// inline `#tag`), groups pages by tag, and lets the user browse.

const FM_TAGS_RE = /^tags:\s*\[([^\]]*)\]/m;
const INLINE_TAG_RE = /(?:^|\s)#([a-zA-Z][\w-]*)/g;

export async function showTagIndex(): Promise<void> {
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  if (mdFiles.length === 0) {
    hostEditor.showInformation("No markdown files found.");
    return;
  }

  const tagMap = new Map<string, { label: string; uri: Uri }[]>();

  for (const uri of mdFiles) {
    try {
      const doc = await hostEditor.openTextDocument(uri);
      const text = doc.getText();
      const tags = extractTags(text);
      const title = deriveTitle(uri);

      for (const tag of tags) {
        const normalised = tag.toLowerCase();
        if (!tagMap.has(normalised)) {
          tagMap.set(normalised, []);
        }
        tagMap.get(normalised)!.push({ label: title, uri });
      }
    } catch {
      // skip unreadable
    }
  }

  if (tagMap.size === 0) {
    hostEditor.showInformation("No tags found in any markdown files.");
    return;
  }

  // Step 1: pick a tag
  const tagItems = Array.from(tagMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, pages]) => ({
      label: `#${tag}`,
      description: `${pages.length} page(s)`,
      tag,
    }));

  const tagPick = await hostEditor.showQuickPick(tagItems, {
    placeHolder: "Browse by tag",
    matchOnDescription: true,
  });
  if (!tagPick) {
    return;
  }

  // Step 2: pick a page in that tag
  const pages = tagMap.get(tagPick.tag) || [];
  const pageItems = pages.map((p) => ({
    label: p.label,
    detail: path.relative(hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath || "", p.uri.fsPath).replace(/\\/g, "/"),
    uri: p.uri,
  }));

  const pagePick = await hostEditor.showQuickPick(pageItems, {
    placeHolder: `Pages tagged #${tagPick.tag}`,
    matchOnDetail: true,
  });
  if (!pagePick) {
    return;
  }

  const doc = await hostEditor.openTextDocument(pagePick.uri);
  await hostEditor.showTextDocument(doc);
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();

  // Frontmatter tags
  const fmMatch = text.match(FM_TAGS_RE);
  if (fmMatch) {
    const raw = fmMatch[1];
    for (const tag of raw.split(",")) {
      const t = tag.trim().replace(/['"]/g, "");
      if (t) {
        tags.add(t);
      }
    }
  }

  // Inline #tags (only outside code blocks for simplicity)
  const stripped = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");

  let match: RegExpExecArray | null;
  while ((match = INLINE_TAG_RE.exec(stripped)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}

function deriveTitle(uri: Uri): string {
  const parsed = path.parse(uri.fsPath);
  const baseName = parsed.name.toLowerCase() === "index" ? path.basename(path.dirname(uri.fsPath)) : parsed.name;
  return baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
