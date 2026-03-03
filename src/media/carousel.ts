
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

/** Disabled — kept for reference but not registered. */
export const CAROUSEL_SLASH_COMMAND: SlashCommand = {
  label: "/carousel",
  insertText: "",
  detail: "🎠 Insert an image carousel from .rsrc",
  isAction: true,
  commandId: Cmd.insertCarousel,
  kind: 16,
  handler: handleCarouselCommand,
};

const CAROUSEL_MARKER = "<!--lotion-carousel-->";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);

/** Return all image files inside `dir` (non-recursive, sorted). */
function listImages(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort();
}

/**
 * Handles the /carousel command.
 *
 * Flow:
 * 1. Show existing .rsrc/ subfolders as a pick list, plus a "Create new" option.
 * 2. If "Create new" is picked, prompt for a name and create the folder.
 * 3. Insert the carousel block immediately with whatever images are in the folder.
 */
export async function handleCarouselCommand(document: TextDocument, position: Position): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  const rsrcDir = path.join(cwd, ".rsrc");

  // 1. Build pick list from existing .rsrc subfolders
  const CREATE_NEW_LABEL = "$(add) Create new folder…";
  const existingFolders: { label: string; description?: string }[] = [];

  if (fs.existsSync(rsrcDir)) {
    const entries = fs.readdirSync(rsrcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const imgCount = listImages(path.join(rsrcDir, entry.name)).length;
        existingFolders.push({
          label: entry.name,
          description: imgCount > 0 ? `${imgCount} image${imgCount > 1 ? "s" : ""}` : "empty",
        });
      }
    }
    existingFolders.sort((a, b) => a.label.localeCompare(b.label));
  }

  const pickItems = [...existingFolders, { label: CREATE_NEW_LABEL, description: "Create a new subfolder in .rsrc/" }];

  const picked = await hostEditor.showQuickPick(pickItems, {
    placeHolder: "Pick a carousel folder from .rsrc/",
  });
  if (!picked) return;

  let folderName: string;

  if (picked.label === CREATE_NEW_LABEL) {
    // 2. Prompt for new folder name
    const name = await hostEditor.showInputBox({
      prompt: "New carousel folder name (created inside .rsrc/)",
      placeHolder: "e.g. vacation-photos",
      validateInput: (v) => {
        if (!v || v.trim().length === 0) return "Name cannot be empty";
        if (/[<>:"/\\|?*]/.test(v)) return "Contains invalid characters";
        return undefined;
      },
    });
    if (!name) return;
    folderName = name.trim();
    const folderPath = path.join(rsrcDir, folderName);
    fs.mkdirSync(folderPath, { recursive: true });
  } else {
    folderName = picked.label;
  }

  const folderPath = path.join(rsrcDir, folderName);

  // 3. Prompt for carousel title
  const title = await hostEditor.showInputBox({
    prompt: "Carousel title (shown as the summary)",
    value: folderName,
    validateInput: (v) => (!v || v.trim().length === 0 ? "Title cannot be empty" : undefined),
  });
  if (!title) return;

  // 4. Build the carousel block
  const relFolder = `.rsrc/${folderName}`;
  const imageFiles = listImages(folderPath);
  const carouselImages = imageFiles.length > 0
    ? imageFiles.map((f) => `  <img src="${relFolder}/${f}" alt="${f}">`).join("\n")
    : `  <!-- add images to ${relFolder}/ and re-run /carousel -->`;

  const carouselBlock = `<details>
${CAROUSEL_MARKER}
<summary>
<span class="carousel-title">${title}</span>
<div class="lotion-carousel" data-folder="${relFolder}">
${carouselImages}
</div>
</summary>

</details>
`;

  // 5. Insert the carousel block
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) return;

  const lineText = document.lineAt(position.line).text;
  const slashIdx = lineText.lastIndexOf("/", position.character);
  if (slashIdx >= 0) {
    const replaceRange = new Range(position.line, slashIdx, position.line, position.character);
    await hostEditor.replaceRange(replaceRange, carouselBlock);
  } else {
    await hostEditor.insertAt(position, carouselBlock);
  }
}
