import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { migrateComments } from "../editor/comments";
import { migrateProcessors } from "../editor/processor";

// ── Extract to subpage ─────────────────────────────────────────────
//
// Takes the current selection (or the current heading section), moves
// it to a new child page, and replaces it with a markdown link.

export async function handleExtractToSubpage(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const document = hostEditor.getDocument()!;
  const selection = hostEditor.getSelection()!;

  // Determine the content to extract
  let extractRange: Range;
  let suggestedName = "";

  if (!selection.isEmpty) {
    extractRange = selection;
    // Try to use the first heading as the name
    const firstLine = document.lineAt(selection.start.line).text;
    const headingMatch = firstLine.match(/^#+\s+(.+)/);
    if (headingMatch) {
      suggestedName = headingMatch[1].trim();
    }
  } else {
    // Extract the current heading section
    const section = getHeadingSection(document, selection.active.line);
    if (!section) {
      hostEditor.showWarning("Select text or place cursor under a heading to extract.");
      return;
    }
    extractRange = section.range;
    suggestedName = section.title;
  }

  const content = hostEditor.getDocumentText(extractRange);
  if (!content.trim()) {
    hostEditor.showWarning("Nothing to extract.");
    return;
  }

  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  // Ask for the page name
  const pageName = await hostEditor.showInputBox({
    prompt: "Name for the new subpage",
    value: suggestedName,
    placeHolder: "my-subpage",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Page name cannot be empty";
      }
      if (/[<>:"/\\|?*]/.test(value)) {
        return "Page name contains invalid characters";
      }
      return undefined;
    },
  });

  if (!pageName) {
    return;
  }

  const folderName = pageName.toLowerCase().replace(/\s+/g, "-");
  const pageDir = path.join(cwd, folderName);
  const childFilePath = path.join(pageDir, "index.md");
  const relativePath = `${folderName}/index.md`;

  // Create directories
  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }

  // Write the extracted content to the new page
  const pageContent = content.startsWith("#") ? content : `# ${pageName}\n\n${content}`;
  fs.writeFileSync(childFilePath, pageContent + "\n", "utf-8");

  // Migrate comments and processors from parent to child page
  migrateMetadata(pageContent, document.uri.fsPath, childFilePath);

  // Replace the extracted content with a link
  await hostEditor.replaceRange(extractRange, `[${pageName}](${relativePath})`);
  await hostEditor.saveActiveDocument();

  // Open the new page
  const newDoc = await hostEditor.openTextDocument(childFilePath);
  await hostEditor.showTextDocument(newDoc);

  hostEditor.showInformation(`Extracted to ${relativePath}`);
}

function getHeadingSection(document: TextDocument, line: number): { range: Range; title: string } | undefined {
  // Walk upward to find the heading that contains this line
  let headingLine = -1;
  let headingLevel = 0;
  let title = "";

  for (let i = line; i >= 0; i--) {
    const text = document.lineAt(i).text;
    const match = text.match(/^(#+)\s+(.+)/);
    if (match) {
      headingLine = i;
      headingLevel = match[1].length;
      title = match[2].trim();
      break;
    }
  }

  if (headingLine < 0) {
    return undefined;
  }

  // Find the end of this section (next heading of same or higher level, or EOF)
  let endLine = document.lineCount - 1;
  for (let i = headingLine + 1; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;
    const match = text.match(/^(#+)\s/);
    if (match && match[1].length <= headingLevel) {
      endLine = i - 1;
      break;
    }
  }

  // Trim trailing blank lines
  while (endLine > headingLine && document.lineAt(endLine).text.trim() === "") {
    endLine--;
  }

  const range = new Range(new Position(headingLine, 0), new Position(endLine, document.lineAt(endLine).text.length));

  return { range, title };
}

// ── Metadata migration ─────────────────────────────────────────────

function migrateMetadata(text: string, srcDocPath: string, destDocPath: string): void {
  migrateComments(text, srcDocPath, destDocPath);
  migrateProcessors(text, srcDocPath, destDocPath);
}
