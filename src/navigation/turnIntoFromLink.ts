import type { QuickPickItem, TextDocument, TextLine } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Regex } from "../core/regex";
import { migrateMetadata } from "./turnIntoMetadata";

const HEADING_RE = Regex.headingLineWithText;

// ── Link → Heading ─────────────────────────────────────────────────

export async function turnIntoFromLink(doc: TextDocument, line: TextLine, match: RegExpMatchArray): Promise<void> {
  const linkTitle = match[1];
  const linkPath = match[2];

  interface TurnIntoOption extends QuickPickItem {
    id: string;
  }

  const options: TurnIntoOption[] = [
    { label: "Heading 1", description: `# ${linkTitle}`, id: "h1" },
    { label: "Heading 2", description: `## ${linkTitle}`, id: "h2" },
    { label: "Heading 3", description: `### ${linkTitle}`, id: "h3" },
  ];

  const pick = await hostEditor.showQuickPick(options, {
    placeHolder: `Turn "${linkTitle}" link into…`,
  });

  if (!pick) {
    return;
  }

  const level = parseInt(pick.id[1], 10);
  await linkToHeading(doc, line, linkTitle, linkPath, level);
}

async function linkToHeading(
  doc: TextDocument,
  line: TextLine,
  title: string,
  relativeLinkPath: string,
  level: number,
): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    return;
  }

  const absPath = path.resolve(cwd, relativeLinkPath);

  if (!fs.existsSync(absPath)) {
    hostEditor.showError(`Lotion: file not found — ${relativeLinkPath}`);
    return;
  }

  // Read the linked file
  const content = fs.readFileSync(absPath, "utf-8");
  const lines = content.split(Regex.lineBreakSplit);

  // Strip the first heading (we'll replace it with the new level)
  let bodyStartIndex = 0;
  if (lines.length > 0 && HEADING_RE.test(lines[0])) {
    bodyStartIndex = 1;
  }

  // Trim leading blank lines from body
  while (bodyStartIndex < lines.length && lines[bodyStartIndex].trim() === "") {
    bodyStartIndex++;
  }

  // Trim trailing blank lines
  let bodyEndIndex = lines.length - 1;
  while (bodyEndIndex >= bodyStartIndex && lines[bodyEndIndex].trim() === "") {
    bodyEndIndex--;
  }

  const bodyLines = lines.slice(bodyStartIndex, bodyEndIndex + 1);
  const prefix = "#".repeat(level);
  const replacement = bodyLines.length > 0 ? `${prefix} ${title}\n\n${bodyLines.join("\n")}` : `${prefix} ${title}`;

  await hostEditor.replaceRange(line.range, replacement);

  // Migrate comments and processors from child page to parent
  const parentDocPath = doc.uri.fsPath;
  migrateMetadata(replacement, absPath, parentDocPath);

  // Move .rsrc/ from the child page directory to the current page's directory
  const childDir = path.dirname(absPath);
  const childRsrc = path.join(childDir, ".rsrc");
  if (fs.existsSync(childRsrc)) {
    const parentRsrc = path.join(cwd, ".rsrc");
    if (!fs.existsSync(parentRsrc)) {
      fs.mkdirSync(parentRsrc, { recursive: true });
    }
    for (const file of fs.readdirSync(childRsrc)) {
      const src = path.join(childRsrc, file);
      const dest = path.join(parentRsrc, file);
      // Avoid overwriting — add suffix if name clashes
      if (fs.existsSync(dest)) {
        const parsed = path.parse(file);
        const unique = `${parsed.name}_${Date.now()}${parsed.ext}`;
        fs.renameSync(src, path.join(parentRsrc, unique));
      } else {
        fs.renameSync(src, dest);
      }
    }
  }

  // Delete the child page file and clean up empty directories
  fs.unlinkSync(absPath);
  try {
    // Remove .rsrc/ if now empty
    if (fs.existsSync(childRsrc) && fs.readdirSync(childRsrc).length === 0) {
      fs.rmdirSync(childRsrc);
    }
    // Remove page directory if empty
    const remaining = fs.readdirSync(childDir);
    if (remaining.length === 0) {
      fs.rmdirSync(childDir);
    }
  } catch {
    /* ignore */
  }
}
