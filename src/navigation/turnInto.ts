import { Position, Range } from "../hostEditor/EditorTypes";
import type { QuickPickItem, TextDocument, TextLine } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { migrateComments } from "../editor/comments";
import { migrateProcessors } from "../editor/processor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const TURNINTO_SLASH_COMMAND: SlashCommand = {
  label: "/turninto",
  insertText: "",
  detail: "🔄 Turn heading/link into something else",
  isAction: true,
  commandId: Cmd.turnInto,
  kind: 2,
  handler: handleTurnInto,
};

// ── Patterns ───────────────────────────────────────────────────────
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const PAGE_LINK_RE = /^\[([^\]]+)\]\(([^)]+\.md)\)\s*$/;
const TOGGLE_HEADING_OPEN_RE = /^<details(\s+open)?>$/;
const TOGGLE_HEADING_SUMMARY_RE = /^<summary><h([1-6])>(.+)<\/h[1-6]><\/summary>$/;

// ── "Turn into…" command ───────────────────────────────────────────

/**
 * Context-aware "Turn into" command.
 *
 * - On a heading line → offer to change level or convert to subpage
 * - On a subpage link line → offer to inline as heading
 *
 * Supports two calling conventions:
 *   1. (doc, pos) — slash-command / slashHandler path
 *   2. () — command palette / keybinding path (uses active editor)
 */
export async function handleTurnInto(docOrNothing?: TextDocument, posOrNothing?: Position): Promise<void> {
  let doc: TextDocument;
  let line: TextLine;

  if (docOrNothing && posOrNothing) {
    await hostEditor.showTextDocument(docOrNothing);
    doc = docOrNothing;
    line = doc.lineAt(posOrNothing.line);
  } else {
    if (!hostEditor.isMarkdownEditor()) {
      return;
    }
    const cursor = hostEditor.getCursorPosition();
    if (!cursor) {
      return;
    }
    const uri = hostEditor.getDocumentUri();
    if (!uri) {
      return;
    }
    doc = await hostEditor.openTextDocument(uri);
    line = doc.lineAt(cursor.line);
  }
  const lineText = line.text;

  const headingMatch = lineText.match(HEADING_RE);
  const linkMatch = lineText.match(PAGE_LINK_RE);
  const toggleMatch = lineText.match(TOGGLE_HEADING_OPEN_RE);

  if (headingMatch) {
    await turnIntoFromHeading(doc, line, headingMatch);
  } else if (toggleMatch) {
    await turnIntoFromToggleHeading(doc, line);
  } else if (linkMatch) {
    await turnIntoFromLink(doc, line, linkMatch);
  } else {
    hostEditor.showInformation("Lotion: Place cursor on a heading or a page link to use Turn Into.");
  }
}

// ── Heading → something else ───────────────────────────────────────

async function turnIntoFromHeading(doc: TextDocument, line: TextLine, match: RegExpMatchArray): Promise<void> {
  const currentLevel = match[1].length;
  const headingText = match[2];

  interface TurnIntoOption extends QuickPickItem {
    id: string;
  }

  const options: TurnIntoOption[] = [];

  // Offer other heading levels
  for (let lv = 1; lv <= 3; lv++) {
    if (lv !== currentLevel) {
      options.push({
        label: `Heading ${lv}`,
        description: `${"#".repeat(lv)} ${headingText}`,
        id: `h${lv}`,
      });
    }
  }

  // Offer toggle heading conversions
  for (let lv = 1; lv <= 3; lv++) {
    options.push({
      label: `Toggle Heading ${lv}`,
      description: `<details><summary><h${lv}>${headingText}</h${lv}></summary>`,
      id: `t${lv}`,
    });
  }

  // Offer subpage conversion
  options.push({
    label: "Subpage",
    description: `Extract heading + content into a child page`,
    id: "subpage",
  });

  const pick = await hostEditor.showQuickPick(options, {
    placeHolder: `Turn "${headingText}" into…`,
  });

  if (!pick) {
    return;
  }

  if (pick.id.startsWith("h")) {
    const newLevel = parseInt(pick.id[1], 10);
    const newPrefix = "#".repeat(newLevel);
    await hostEditor.replaceRange(line.range, `${newPrefix} ${headingText}`);
  } else if (pick.id.startsWith("t")) {
    const toggleLevel = parseInt(pick.id[1], 10);
    await headingToToggleHeading(doc, line, currentLevel, headingText, toggleLevel);
  } else if (pick.id === "subpage") {
    await headingToSubpage(doc, line, currentLevel, headingText);
  }
}

// ── Heading → Toggle Heading ───────────────────────────────────────

async function headingToToggleHeading(
  doc: TextDocument,
  headingLine: TextLine,
  level: number,
  title: string,
  toggleLevel: number,
): Promise<void> {
  // Find the extent of this section (same logic as subpage extraction)
  const sectionStart = headingLine.lineNumber;
  let sectionEnd = doc.lineCount - 1;

  for (let i = sectionStart + 1; i < doc.lineCount; i++) {
    const m = doc.lineAt(i).text.match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      sectionEnd = i - 1;
      break;
    }
  }

  // Gather the body (lines after the heading)
  const bodyLines: string[] = [];
  for (let i = sectionStart + 1; i <= sectionEnd; i++) {
    bodyLines.push(doc.lineAt(i).text);
  }

  // Trim leading/trailing blank lines from body
  while (bodyLines.length > 0 && bodyLines[0].trim() === "") {
    bodyLines.shift();
  }
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  const hTag = `h${toggleLevel}`;
  const bodyText = bodyLines.length > 0 ? `\n${bodyLines.join("\n")}\n` : "\n";
  const replacement = `<details>\n<summary><${hTag}>${title}</${hTag}></summary>\n${bodyText}\n</details>`;

  const replaceRange = new Range(
    new Position(sectionStart, 0),
    new Position(sectionEnd, doc.lineAt(sectionEnd).text.length),
  );

  await hostEditor.replaceRange(replaceRange, replacement);
}

// ── Toggle Heading → something else ───────────────────────────────

async function turnIntoFromToggleHeading(doc: TextDocument, detailsLine: TextLine): Promise<void> {
  const startLine = detailsLine.lineNumber;

  // Next line should be <summary><hN>...</hN></summary>
  if (startLine + 1 >= doc.lineCount) {
    return;
  }
  const summaryText = doc.lineAt(startLine + 1).text;
  const summaryMatch = summaryText.match(TOGGLE_HEADING_SUMMARY_RE);
  if (!summaryMatch) {
    hostEditor.showInformation("Lotion: Place cursor on a toggle heading to use Turn Into.");
    return;
  }

  const currentLevel = parseInt(summaryMatch[1], 10);
  const headingText = summaryMatch[2];

  // Find the closing </details> tag
  let closingLine = -1;
  for (let i = startLine + 2; i < doc.lineCount; i++) {
    if (doc.lineAt(i).text.trim() === "</details>") {
      closingLine = i;
      break;
    }
  }
  if (closingLine === -1) {
    return;
  }

  interface TurnIntoOption extends QuickPickItem {
    id: string;
  }

  const options: TurnIntoOption[] = [];

  // Offer regular heading levels
  for (let lv = 1; lv <= 3; lv++) {
    options.push({
      label: `Heading ${lv}`,
      description: `${"#".repeat(lv)} ${headingText}`,
      id: `h${lv}`,
    });
  }

  // Offer other toggle heading levels
  for (let lv = 1; lv <= 3; lv++) {
    if (lv !== currentLevel) {
      options.push({
        label: `Toggle Heading ${lv}`,
        description: `<details><summary><h${lv}>${headingText}</h${lv}></summary>`,
        id: `t${lv}`,
      });
    }
  }

  const pick = await hostEditor.showQuickPick(options, {
    placeHolder: `Turn toggle "${headingText}" into…`,
  });

  if (!pick) {
    return;
  }

  // Extract body lines (between </summary> and </details>)
  const bodyLines: string[] = [];
  for (let i = startLine + 2; i < closingLine; i++) {
    bodyLines.push(doc.lineAt(i).text);
  }

  // Trim leading/trailing blank lines
  while (bodyLines.length > 0 && bodyLines[0].trim() === "") {
    bodyLines.shift();
  }
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  const replaceRange = new Range(
    new Position(startLine, 0),
    new Position(closingLine, doc.lineAt(closingLine).text.length),
  );

  if (pick.id.startsWith("h")) {
    const newLevel = parseInt(pick.id[1], 10);
    const prefix = "#".repeat(newLevel);
    const bodyText = bodyLines.length > 0 ? `\n\n${bodyLines.join("\n")}` : "";
    await hostEditor.replaceRange(replaceRange, `${prefix} ${headingText}${bodyText}`);
  } else if (pick.id.startsWith("t")) {
    const newLevel = parseInt(pick.id[1], 10);
    const hTag = `h${newLevel}`;
    const bodyText = bodyLines.length > 0 ? `\n${bodyLines.join("\n")}\n` : "\n";
    const replacement = `<details>\n<summary><${hTag}>${headingText}</${hTag}></summary>\n${bodyText}\n</details>`;
    await hostEditor.replaceRange(replaceRange, replacement);
  }
}

// ── Heading → Subpage ──────────────────────────────────────────────

async function headingToSubpage(doc: TextDocument, headingLine: TextLine, level: number, title: string): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  // Find the extent of this section: from the heading line to just before
  // the next heading of the same or higher level (or end of file).
  const sectionStart = headingLine.lineNumber;
  let sectionEnd = doc.lineCount - 1;

  for (let i = sectionStart + 1; i < doc.lineCount; i++) {
    const m = doc.lineAt(i).text.match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      sectionEnd = i - 1;
      break;
    }
  }

  // Gather the body (lines after the heading)
  const bodyLines: string[] = [];
  for (let i = sectionStart + 1; i <= sectionEnd; i++) {
    bodyLines.push(doc.lineAt(i).text);
  }

  // Trim leading/trailing blank lines from body
  while (bodyLines.length > 0 && bodyLines[0].trim() === "") {
    bodyLines.shift();
  }
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  // Create child page
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const pageDir = path.join(cwd, slug);
  const childFilePath = path.join(pageDir, "index.md");
  const relativePath = `${slug}/index.md`;

  if (fs.existsSync(childFilePath)) {
    const overwrite = await hostEditor.showWarningMessage(`Page "${slug}" already exists. Overwrite?`, [
      "Overwrite",
      "Cancel",
    ]);
    if (overwrite !== "Overwrite") {
      return;
    }
  }

  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }

  // Move referenced .rsrc/ files from parent to child
  const rsrcRe = /\.rsrc\/([^\s)]+)/g;
  const parentRsrc = path.join(cwd, ".rsrc");
  const childRsrc = path.join(pageDir, ".rsrc");
  const bodyText = bodyLines.join("\n");
  let rsrcMatch: RegExpExecArray | null;

  while ((rsrcMatch = rsrcRe.exec(bodyText)) !== null) {
    const fileName = rsrcMatch[1];
    const srcFile = path.join(parentRsrc, fileName);
    if (fs.existsSync(srcFile)) {
      if (!fs.existsSync(childRsrc)) {
        fs.mkdirSync(childRsrc, { recursive: true });
      }
      const destFile = path.join(childRsrc, fileName);
      fs.renameSync(srcFile, destFile);
    }
  }

  const pageContent = `# ${title}\n\n${bodyLines.join("\n")}\n`;
  fs.writeFileSync(childFilePath, pageContent, "utf-8");

  // Migrate comments and processors from parent to child page
  const parentDocPath = doc.uri.fsPath;
  migrateMetadata(pageContent, parentDocPath, childFilePath);

  // Replace heading + section with a link
  const replaceRange = new Range(
    new Position(sectionStart, 0),
    new Position(sectionEnd, doc.lineAt(sectionEnd).text.length),
  );

  await hostEditor.replaceRange(replaceRange, `[${title}](${relativePath})`);

  await doc.save();
  hostEditor.showInformation(`Extracted to ${relativePath}`);
}

// ── Link → Heading ─────────────────────────────────────────────────

async function turnIntoFromLink(doc: TextDocument, line: TextLine, match: RegExpMatchArray): Promise<void> {
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
  const lines = content.split(/\r?\n/);

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
    // Update image paths in the inlined body from <slug>/.rsrc/ → .rsrc/
    // (the replacement text is already in the editor at this point)
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

// ── Metadata migration ─────────────────────────────────────────────

/**
 * Move comment and processor entries from srcDoc to destDoc for any
 * markers found in the given text.
 */
function migrateMetadata(text: string, srcDocPath: string, destDocPath: string): void {
  // Comments
  migrateComments(text, srcDocPath, destDocPath);

  // Processors
  migrateProcessors(text, srcDocPath, destDocPath);
}
