import { Position, Range } from "../hostEditor/EditorTypes";
import type { QuickPickItem, TextDocument, TextLine } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Regex } from "../core/regex";
import { toPathSlug } from "../core/slug";
import { migrateMetadata } from "./turnIntoMetadata";

// ── Heading → something else ───────────────────────────────────────

export async function turnIntoFromHeading(
  doc: TextDocument,
  line: TextLine,
  match: RegExpMatchArray,
): Promise<void> {
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
    const m = doc.lineAt(i).text.match(Regex.headingPrefix);
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

// ── Heading → Subpage ──────────────────────────────────────────────

async function headingToSubpage(
  doc: TextDocument,
  headingLine: TextLine,
  level: number,
  title: string,
): Promise<void> {
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
    const m = doc.lineAt(i).text.match(Regex.headingPrefix);
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
  const slug = toPathSlug(title);
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
  const rsrcRe = Regex.rsrcPathGlobal;
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
