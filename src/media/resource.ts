import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as fs from "fs";
import * as path from "path";
import { getCwd } from "../core/cwd";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);

export const RESOURCE_SLASH_COMMAND: SlashCommand = {
  label: "/resource",
  insertText: "",
  detail: "📎 Attach a file from disk into .rsrc",
  isAction: true,
  commandId: Cmd.insertResource,
  kind: 16,
  handler: handleResourceCommand,
};

export async function handleResourceCommand(document: TextDocument, position: Position): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  const picks = await hostEditor.showOpenDialog({
    canSelectMany: false,
    openLabel: "Select Resource",
  });
  if (!picks || picks.length === 0) {
    return;
  }

  const srcPath = picks[0].fsPath;
  const ext = path.extname(srcPath).toLowerCase();
  if (IMAGE_EXTS.has(ext)) {
    hostEditor.showWarning("Use /image for image files.");
    return;
  }

  const rsrcDir = path.join(cwd, ".rsrc");
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
  }

  const base = path.basename(srcPath);
  let destName = base;
  let counter = 1;
  while (fs.existsSync(path.join(rsrcDir, destName))) {
    const parsed = path.parse(base);
    destName = `${parsed.name}-${counter}${parsed.ext}`;
    counter++;
  }

  fs.copyFileSync(srcPath, path.join(rsrcDir, destName));

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const triggerRange = new Range(position.translate(0, -1), position);
  const label = path.parse(destName).name;
  await hostEditor.replaceRange(triggerRange, `[${label}](.rsrc/${destName})`);
  await hostEditor.saveActiveDocument();
}
