import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Filter } from "../core/cmdFilter";
import type { SlashCommand } from "../core/slashCommands";
import { parseImageLine, serializeImage } from "./imageBlock";

// ── Image caption slash command ────────────────────────────────────
//
// Wraps the current line's image in
//   <figure>
//     <img ...>
//     <figcaption>caption</figcaption>
//   </figure>
// If the image is already inside a `<figure>`, updates the caption
// text in place instead of nesting a second figure.

const FIGURE_OPEN = /^\s*<figure\b[^>]*>\s*$/i;
const FIGURE_CLOSE = /^\s*<\/figure>\s*$/i;
const FIGCAPTION_LINE = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i;

interface FigureRange {
  openLine: number;
  closeLine: number;
  captionLine: number | null;
}

function findFigureAround(doc: TextDocument, line: number): FigureRange | null {
  let openLine = -1;
  for (let i = line; i >= 0; i--) {
    if (FIGURE_OPEN.test(doc.lineAt(i).text)) {
      openLine = i;
      break;
    }
    if (FIGURE_CLOSE.test(doc.lineAt(i).text) && i < line) return null;
  }
  if (openLine === -1) return null;

  let closeLine = -1;
  for (let i = line; i < doc.lineCount; i++) {
    if (FIGURE_CLOSE.test(doc.lineAt(i).text)) {
      closeLine = i;
      break;
    }
    if (FIGURE_OPEN.test(doc.lineAt(i).text) && i > line) return null;
  }
  if (closeLine === -1) return null;

  let captionLine: number | null = null;
  for (let i = openLine + 1; i < closeLine; i++) {
    if (FIGCAPTION_LINE.test(doc.lineAt(i).text)) {
      captionLine = i;
      break;
    }
  }

  return { openLine, closeLine, captionLine };
}

async function handleImgCaption(doc: TextDocument, pos: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(doc)) return;

  const line = doc.lineAt(pos.line).text;
  const parsed = parseImageLine(line);
  if (!parsed) {
    hostEditor.showWarning("Lotion: no image on this line.");
    return;
  }

  const existingFigure = findFigureAround(doc, pos.line);
  const existingCaption =
    existingFigure?.captionLine !== null && existingFigure?.captionLine !== undefined
      ? (doc.lineAt(existingFigure.captionLine).text.match(FIGCAPTION_LINE)?.[1] ?? "")
      : (parsed.model.alt ?? "");

  const caption = await hostEditor.showInputBox({
    prompt: existingFigure ? "Update caption" : "Caption text",
    value: existingCaption,
  });
  if (caption === undefined) return;

  const trimmed = caption.trim();
  const escaped = escapeHtml(trimmed);

  // ── Update in place if the image already sits in a <figure>. ──────
  if (existingFigure) {
    if (existingFigure.captionLine !== null) {
      const capLine = doc.lineAt(existingFigure.captionLine);
      const replaced = capLine.text.replace(FIGCAPTION_LINE, `<figcaption>${escaped}</figcaption>`);
      await hostEditor.replaceRange(
        new Range(existingFigure.captionLine, 0, existingFigure.captionLine, capLine.text.length),
        replaced,
      );
    } else {
      // Insert a figcaption line before the closing tag.
      const insertLine = existingFigure.closeLine;
      const indent = doc.lineAt(existingFigure.openLine).text.match(/^\s*/)?.[0] ?? "";
      await hostEditor.replaceRange(
        new Range(insertLine, 0, insertLine, 0),
        `${indent}  <figcaption>${escaped}</figcaption>\n`,
      );
    }
    return;
  }

  // ── Wrap the image line in a fresh <figure>. ──────────────────────
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const imgTag = serializeImage(parsed.model);

  // If the image was inline with other content on the line, splice
  // just the image span; otherwise replace the whole line.
  const isSoleContent = line.trim() === line.slice(parsed.startCol, parsed.endCol).trim();
  const block = [
    `${indent}<figure>`,
    `${indent}  ${imgTag}`,
    `${indent}  <figcaption>${escaped}</figcaption>`,
    `${indent}</figure>`,
  ].join("\n");

  if (isSoleContent) {
    await hostEditor.replaceRange(new Range(pos.line, 0, pos.line, line.length), block);
  } else {
    await hostEditor.replaceRange(new Range(pos.line, parsed.startCol, pos.line, parsed.endCol), `\n${block}\n`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const IMAGE_CAPTION_SLASH_COMMAND: SlashCommand = {
  label: "/img-caption",
  insertText: "",
  detail: "Image: add or edit a caption (wraps in <figure>)",
  isAction: true,
  commandId: Cmd.imgCaption,
  handler: handleImgCaption,
  cmdFilter: Filter().cursorOnImage(),
};
