import * as path from "path";
import * as fs from "fs";
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import { Filter } from "../core/cmdFilter";
import type { SlashCommand } from "../core/slashCommands";
import { parseImageLine, serializeImage } from "./imageBlock";

// ── Sugar slash commands ───────────────────────────────────────────
//
// Small quality-of-life actions on the image at the cursor:
//   /img-alt       — edit alt text (works on both md and html forms)
//   /img-copy-path — copy the image src to the clipboard
//   /img-reveal    — reveal the image file in the OS file browser

async function handleImgAlt(doc: TextDocument, pos: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(doc)) return;
  const line = doc.lineAt(pos.line).text;
  const parsed = parseImageLine(line);
  if (!parsed) {
    hostEditor.showWarning("Lotion: no image on this line.");
    return;
  }

  const alt = await hostEditor.showInputBox({
    prompt: "Alt text",
    value: parsed.model.alt,
  });
  if (alt === undefined) return;

  const newText = serializeImage({ ...parsed.model, alt });
  await hostEditor.replaceRange(new Range(pos.line, parsed.startCol, pos.line, parsed.endCol), newText);
}

async function handleImgCopyPath(doc: TextDocument, pos: Position): Promise<void> {
  const line = doc.lineAt(pos.line).text;
  const parsed = parseImageLine(line);
  if (!parsed) {
    hostEditor.showWarning("Lotion: no image on this line.");
    return;
  }
  await hostEditor.writeClipboardText(parsed.model.src);
  await hostEditor.showInformation(`Lotion: copied ${parsed.model.src}`);
}

async function handleImgReveal(doc: TextDocument, pos: Position): Promise<void> {
  const line = doc.lineAt(pos.line).text;
  const parsed = parseImageLine(line);
  if (!parsed) {
    hostEditor.showWarning("Lotion: no image on this line.");
    return;
  }
  const src = parsed.model.src;
  if (Regex.httpOrMailtoOrAnchor.test(src) || src.startsWith("data:")) {
    hostEditor.showWarning("Lotion: cannot reveal — this image is a remote or data URL.");
    return;
  }
  const docDir = path.dirname(doc.uri.fsPath);
  const resolved = path.isAbsolute(src) ? src : path.resolve(docDir, src);
  if (!fs.existsSync(resolved)) {
    hostEditor.showWarning(`Lotion: file not found — ${resolved}`);
    return;
  }
  await hostEditor.revealFileInOS(resolved);
}

const gate = Filter().cursorOnImage();

export const IMAGE_SUGAR_SLASH_COMMANDS: SlashCommand[] = [
  {
    label: "/img-alt",
    insertText: "",
    detail: "Image: edit alt text",
    isAction: true,
    commandId: Cmd.imgAlt,
    handler: handleImgAlt,
    cmdFilter: gate,
  },
  {
    label: "/img-copy-path",
    insertText: "",
    detail: "Image: copy src to clipboard",
    isAction: true,
    commandId: Cmd.imgCopyPath,
    handler: handleImgCopyPath,
    cmdFilter: gate,
  },
  {
    label: "/img-reveal",
    insertText: "",
    detail: "Image: reveal file in OS file browser",
    isAction: true,
    commandId: Cmd.imgReveal,
    handler: handleImgReveal,
    cmdFilter: gate,
  },
];
