import { Disposable, Position, Range, TextEdit } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import { toHeadingSlug } from "../core/slug";
import type { SlashCommand } from "../core/slashCommands";

export const TOC_SLASH_COMMAND: SlashCommand = {
  label: "/toc",
  insertText: "",
  detail: "\ud83d\udcd1 Table of contents from headings",
  isAction: true,
  commandId: Cmd.insertToc,
  kind: 17,
  handler: handleTocCommand,
};

// ── /toc handler — generate a table of contents ────────────────────

const TOC_START = "<!-- toc-start -->";
const TOC_END = "<!-- toc-end -->";

function buildTocLines(document: TextDocument): string[] {
  const headings: { level: number; text: string; slug: string }[] = [];

  let inTocBlock = false;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (line.includes(TOC_START)) {
      inTocBlock = true;
      continue;
    }
    if (line.includes(TOC_END)) {
      inTocBlock = false;
      continue;
    }
    if (inTocBlock) {
      continue;
    }

    const match = line.match(Regex.headingLineWithText);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const slug = toHeadingSlug(text);
      headings.push({ level, text, slug });
    }
  }

  if (headings.length === 0) {
    return [];
  }

  const minLevel = Math.min(...headings.map((h) => h.level));
  return headings.map((h) => {
    const indent = "  ".repeat(h.level - minLevel);
    return `${indent}- [${h.text}](#${h.slug})`;
  });
}

export async function handleTocCommand(document: TextDocument, position: Position) {
  const tocLines = buildTocLines(document);

  if (tocLines.length === 0) {
    hostEditor.showInformation("Lotion: no headings found in this document.");
    return;
  }

  const tocText = [TOC_START, ...tocLines, TOC_END].join("\n");

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const triggerRange = new Range(position.translate(0, -1), position);
  await hostEditor.replaceRange(triggerRange, tocText);
}

/**
 * Auto-update TOC blocks (between sentinel comments) on save.
 */
export function createTocAutoUpdater(): Disposable {
  return hostEditor.onWillSaveTextDocument((e) => {
    const doc = e.document;
    if (doc.languageId !== "markdown") {
      return;
    }

    // Find sentinel markers
    let startLine = -1;
    let endLine = -1;
    for (let i = 0; i < doc.lineCount; i++) {
      const text = doc.lineAt(i).text;
      if (text.includes(TOC_START) && startLine === -1) {
        startLine = i;
      }
      if (text.includes(TOC_END) && startLine !== -1) {
        endLine = i;
        break;
      }
    }

    if (startLine === -1 || endLine === -1 || startLine >= endLine) {
      return; // no TOC block
    }

    const newTocLines = buildTocLines(doc);
    if (newTocLines.length === 0) {
      return;
    }

    const newContent = [TOC_START, ...newTocLines, TOC_END].join("\n");
    const range = new Range(startLine, 0, endLine, doc.lineAt(endLine).text.length);

    e.waitUntil(Promise.resolve([TextEdit.replace(range, newContent)]));
  });
}
