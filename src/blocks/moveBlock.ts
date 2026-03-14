import { Position, Range, Uri } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Regex } from "../core/regex";
import { migrateComments } from "../editor/comments";
import { migrateProcessors } from "../editor/processor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const MOVE_SLASH_COMMAND: SlashCommand = {
  label: "/move",
  insertText: "",
  detail: "📤 Move block to another page",
  isAction: true,
  commandId: Cmd.moveBlock,
  kind: 2,
  handler: handleMoveCommand,
};

// ── Patterns ───────────────────────────────────────────────────────

const HEADING_RE = Regex.headingLineWithText;

// ── /move handler ──────────────────────────────────────────────────

/**
 * /move — Move the current block to another page.
 *
 * "Block" means:
 *   • If the cursor is on a heading: the heading + all content until the
 *     next heading of equal or higher level (or EOF).
 *   • Otherwise: the current contiguous non-blank paragraph.
 *
 * The user picks a destination page from all workspace .md files.  The
 * block is appended to the target file, resource files (.rsrc/) are
 * migrated, and the block is removed from the source.
 */
export async function handleMoveCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  // ── 1. Determine the block range ────────────────────────────────
  const { startLine, endLine } = getBlockRange(document, position.line);

  // Collect the block text
  const blockLines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    blockLines.push(document.lineAt(i).text);
  }
  const blockText = blockLines.join("\n");

  if (blockText.trim().length === 0) {
    hostEditor.showWarning("Nothing to move — block is empty.");
    return;
  }

  // ── 2. Pick a destination page ──────────────────────────────────
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  const selfPath = document.uri.fsPath;

  const targets = mdFiles
    .filter((uri) => uri.fsPath !== selfPath)
    .map((uri) => {
      const title = deriveTitle(uri);
      const rel = path.relative(cwd, uri.fsPath).replace(Regex.windowsSlash, "/");
      return { label: title, detail: rel, uri };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  if (targets.length === 0) {
    hostEditor.showWarning("No other pages found in workspace.");
    return;
  }

  const pick = await hostEditor.showQuickPick(targets, {
    placeHolder: "Move block to…",
    matchOnDetail: true,
  });
  if (!pick) {
    return;
  }

  // ── 3. Migrate .rsrc/ and child page references ───────────────
  const destDir = path.dirname(pick.uri.fsPath);
  const migratedText = migrateAssets(blockText, cwd, destDir);

  // ── 4. Migrate comments ─────────────────────────────────────────
  const srcDocPath = document.uri.fsPath;
  const destDocPath = pick.uri.fsPath;
  migrateComments(migratedText, srcDocPath, destDocPath);

  // ── 5. Migrate processors ──────────────────────────────────────
  migrateProcessors(migratedText, srcDocPath, destDocPath);

  // ── 6. Append to destination ────────────────────────────────────
  const destContent = fs.readFileSync(pick.uri.fsPath, "utf-8");
  const separator = destContent.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(pick.uri.fsPath, destContent + separator + migratedText + "\n", "utf-8");

  // ── 7. Remove from source ──────────────────────────────────────
  // Expand range to include trailing blank line if present
  let deleteEnd = endLine;
  if (deleteEnd + 1 < document.lineCount && document.lineAt(deleteEnd + 1).text.trim() === "") {
    deleteEnd++;
  }

  const deleteRange = new Range(
    new Position(startLine, 0),
    new Position(deleteEnd, document.lineAt(deleteEnd).text.length),
  );

  await hostEditor.deleteRange(deleteRange);
  await hostEditor.saveActiveDocument();

  hostEditor.showInformation(`Moved block to ${pick.label}.`);
}

// ── Block range detection ──────────────────────────────────────────

/**
 * Determine the start and end lines of the "block" at the given line.
 *
 * Heading block: heading line → just before next heading of ≤ level (or EOF).
 * Paragraph block: contiguous non-blank lines around cursor.
 */
function getBlockRange(document: TextDocument, cursorLine: number): { startLine: number; endLine: number } {
  const lineText = document.lineAt(cursorLine).text;
  const headingMatch = lineText.match(HEADING_RE);

  if (headingMatch) {
    const level = headingMatch[1].length;
    const startLine = cursorLine;
    let endLine = document.lineCount - 1;

    for (let i = startLine + 1; i < document.lineCount; i++) {
      const m = document.lineAt(i).text.match(Regex.headingPrefix);
      if (m && m[1].length <= level) {
        endLine = i - 1;
        break;
      }
    }

    // Trim trailing blank lines from the section
    while (endLine > startLine && document.lineAt(endLine).text.trim() === "") {
      endLine--;
    }

    return { startLine, endLine };
  }

  // Paragraph block — contiguous non-blank lines
  let startLine = cursorLine;
  let endLine = cursorLine;

  while (startLine > 0 && document.lineAt(startLine - 1).text.trim() !== "") {
    startLine--;
  }
  while (endLine < document.lineCount - 1 && document.lineAt(endLine + 1).text.trim() !== "") {
    endLine++;
  }

  return { startLine, endLine };
}

// ── Asset migration ────────────────────────────────────────────────

/**
 * Find all .rsrc/ and child page references in the block, move the files
 * and directories from source to destination, and return the updated text.
 */
function migrateAssets(text: string, srcDir: string, destDir: string): string {
  if (srcDir === destDir) {
    return text;
  }

  // ── Migrate .rsrc/ files ─────────────────────────────────────
  const srcRsrc = path.join(srcDir, ".rsrc");
  const destRsrc = path.join(destDir, ".rsrc");
  const rsrcRe = Regex.rsrcPathGlobal;
  let rsrcMatch: RegExpExecArray | null;

  while ((rsrcMatch = rsrcRe.exec(text)) !== null) {
    const fileName = rsrcMatch[1];
    const srcFile = path.join(srcRsrc, fileName);
    if (fs.existsSync(srcFile)) {
      if (!fs.existsSync(destRsrc)) {
        fs.mkdirSync(destRsrc, { recursive: true });
      }
      const destFile = path.join(destRsrc, fileName);
      if (fs.existsSync(destFile)) {
        const parsed = path.parse(fileName);
        const unique = `${parsed.name}_${Date.now()}${parsed.ext}`;
        fs.renameSync(srcFile, path.join(destRsrc, unique));
        text = text.replace(`.rsrc/${fileName}`, `.rsrc/${unique}`);
      } else {
        fs.renameSync(srcFile, destFile);
      }
    }
  }

  // ── Migrate child page directories ───────────────────────────────
  const childRe = Regex.markdownChildIndexLinkGlobal;
  let childMatch: RegExpExecArray | null;

  while ((childMatch = childRe.exec(text)) !== null) {
    const relPath = childMatch[2]; // e.g. "my-page/index.md"
    const slug = childMatch[3]; // e.g. "my-page"
    const srcChildDir = path.join(srcDir, slug);

    if (!fs.existsSync(srcChildDir)) {
      continue;
    }

    let destSlug = slug;
    const destChildDir = path.join(destDir, slug);
    if (fs.existsSync(destChildDir)) {
      // Name collision — append timestamp
      destSlug = `${slug}-${Date.now()}`;
    }

    const finalDestDir = path.join(destDir, destSlug);
    fs.renameSync(srcChildDir, finalDestDir);

    // Update the link path in text if slug changed
    if (destSlug !== slug) {
      const newRelPath = `${destSlug}/index.md`;
      text = text.replace(relPath, newRelPath);
    }
  }

  return text;
}

// ── Helpers ────────────────────────────────────────────────────────

function deriveTitle(uri: Uri): string {
  const parsed = path.parse(uri.fsPath);
  const baseName = parsed.name.toLowerCase() === "index" ? path.basename(path.dirname(uri.fsPath)) : parsed.name;
  return baseName.replace(Regex.dashUnderscore, " ").replace(Regex.wordBoundaryChar, (c) => c.toUpperCase());
}

// ── Metadata migration helpers ─────────────────────────────────────
// migrateComments and migrateProcessors are imported from their respective modules.
