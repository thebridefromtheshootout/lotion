import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Filter } from "../core/cmdFilter";
import type { SlashCommand } from "../core/slashCommands";
import { type ImageModel, parseImageLine, serializeImage } from "./imageBlock";

// ── Image layout slash commands ────────────────────────────────────
//
// Align (left / right / center / reset) and size (S / M / L / full)
// rewrites for the image on the current line. All share a single
// `mutateImageOnLine` helper — parse → transform → serialize → replace
// the exact span the image occupied on the line.

async function mutateImageOnLine(
  doc: TextDocument,
  pos: Position,
  transform: (m: ImageModel) => ImageModel,
): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(doc)) return;
  const line = doc.lineAt(pos.line).text;
  const parsed = parseImageLine(line);
  if (!parsed) {
    hostEditor.showWarning("Lotion: no image on this line.");
    return;
  }
  const newText = serializeImage(transform(parsed.model));
  const range = new Range(pos.line, parsed.startCol, pos.line, parsed.endCol);
  await hostEditor.replaceRange(range, newText);
}

// ── Align ──────────────────────────────────────────────────────────

async function alignLeft(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, align: "left" }));
}
async function alignRight(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, align: "right" }));
}
async function alignCenter(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, align: "center" }));
}

// Reset strips both layout intents; the serializer collapses back to
// `![alt](src)` when there's nothing else to preserve.
async function reset(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, align: "none", size: "none", customWidth: undefined }));
}

// ── Size ───────────────────────────────────────────────────────────

async function sizeS(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, size: "S", customWidth: undefined }));
}
async function sizeM(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, size: "M", customWidth: undefined }));
}
async function sizeL(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, size: "L", customWidth: undefined }));
}
async function sizeFull(doc: TextDocument, pos: Position): Promise<void> {
  await mutateImageOnLine(doc, pos, (m) => ({ ...m, size: "full", customWidth: undefined }));
}

// ── Slash command definitions ──────────────────────────────────────

const gate = Filter().cursorOnImage();

export const IMAGE_LAYOUT_SLASH_COMMANDS: SlashCommand[] = [
  {
    label: "/img-left",
    insertText: "",
    detail: "Image: wrap text on the right (float left)",
    isAction: true,
    commandId: Cmd.imgAlignLeft,
    handler: alignLeft,
    cmdFilter: gate,
  },
  {
    label: "/img-right",
    insertText: "",
    detail: "Image: wrap text on the left (float right)",
    isAction: true,
    commandId: Cmd.imgAlignRight,
    handler: alignRight,
    cmdFilter: gate,
  },
  {
    label: "/img-center",
    insertText: "",
    detail: "Image: center on its own line",
    isAction: true,
    commandId: Cmd.imgAlignCenter,
    handler: alignCenter,
    cmdFilter: gate,
  },
  {
    label: "/img-reset",
    insertText: "",
    detail: "Image: strip layout (collapse back to markdown when possible)",
    isAction: true,
    commandId: Cmd.imgReset,
    handler: reset,
    cmdFilter: gate,
  },
  {
    label: "/img-s",
    insertText: "",
    detail: "Image: small (150px)",
    isAction: true,
    commandId: Cmd.imgSizeS,
    handler: sizeS,
    cmdFilter: gate,
  },
  {
    label: "/img-m",
    insertText: "",
    detail: "Image: medium (300px)",
    isAction: true,
    commandId: Cmd.imgSizeM,
    handler: sizeM,
    cmdFilter: gate,
  },
  {
    label: "/img-l",
    insertText: "",
    detail: "Image: large (500px)",
    isAction: true,
    commandId: Cmd.imgSizeL,
    handler: sizeL,
    cmdFilter: gate,
  },
  {
    label: "/img-full",
    insertText: "",
    detail: "Image: full width (100%)",
    isAction: true,
    commandId: Cmd.imgSizeFull,
    handler: sizeFull,
    cmdFilter: gate,
  },
];
