import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { getCwd } from "../core/cwd";
import { imageFromClipboard } from "./clipboard";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const IMAGE_SLASH_COMMAND: SlashCommand = {
  label: "/image",
  insertText: "",
  detail: "🖼️ Insert an image",
  isAction: true,
  commandId: Cmd.insertImage,
  kind: 16,
  handler: handleImageCommand,
};

const IMAGE_FILTERS: Record<string, string[]> = {
  Images: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"],
};

// ── Pick an image file from disk and copy into .rsrc/ ──────────────
async function imageFromFile(rsrcDir: string, imageName: string): Promise<string | undefined> {
  const uris = await hostEditor.showOpenDialog({
    canSelectMany: false,
    filters: IMAGE_FILTERS,
    openLabel: "Select Image",
  });

  if (!uris || uris.length === 0) {
    return undefined;
  }

  const srcPath = uris[0].fsPath;
  const ext = path.extname(srcPath).toLowerCase();
  let destName = `${imageName}${ext}`;

  // Avoid overwriting existing files
  let counter = 1;
  while (fs.existsSync(path.join(rsrcDir, destName))) {
    destName = `${imageName}-${counter}${ext}`;
    counter++;
  }

  fs.copyFileSync(srcPath, path.join(rsrcDir, destName));
  return destName;
}

// ── Download an image from a URL into .rsrc/ ───────────────────────
async function imageFromUrl(rsrcDir: string, imageName: string): Promise<string | undefined> {
  const rawUrl = await hostEditor.showInputBox({
    prompt: "Image URL",
    placeHolder: "https://example.com/photo.png",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "URL cannot be empty";
      }
      try {
        const u = new URL(value.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          return "Only http and https URLs are supported";
        }
      } catch {
        return "Invalid URL";
      }
      return undefined;
    },
  });

  if (!rawUrl) {
    return undefined;
  }

  const url = new URL(rawUrl.trim());

  // Infer extension from URL path, default to .png
  let ext = path.extname(url.pathname).toLowerCase();
  if (!ext || ![".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(ext)) {
    ext = ".png";
  }

  let destName = `${imageName}${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(rsrcDir, destName))) {
    destName = `${imageName}-${counter}${ext}`;
    counter++;
  }

  const destPath = path.join(rsrcDir, destName);

  try {
    await downloadToFile(url, destPath);
  } catch (err: any) {
    hostEditor.showError(`Lotion: failed to download image — ${err.message ?? err}`);
    return undefined;
  }

  if (!fs.existsSync(destPath)) {
    hostEditor.showError("Lotion: downloaded file not found.");
    return undefined;
  }

  return destName;
}

// ── Minimal HTTP(S) download with redirect support ─────────────────
function downloadToFile(url: URL, destPath: string, redirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) {
      return reject(new Error("Too many redirects"));
    }

    const lib = url.protocol === "https:" ? https : http;

    lib
      .get(url, (res) => {
        // Follow redirects (301, 302, 307, 308)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url);
          res.resume(); // drain response
          return downloadToFile(next, destPath, redirects - 1).then(resolve, reject);
        }

        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => fileStream.close(() => resolve()));
        fileStream.on("error", (err) => {
          fs.unlink(destPath, () => {}); // clean up partial file
          reject(err);
        });
      })
      .on("error", reject);
  });
}

// ── /image handler ─────────────────────────────────────────────────
export async function handleImageCommand(document: TextDocument, position: Position) {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  const rsrcDir = path.join(cwd, ".rsrc");

  // 1) Ensure .rsrc/ exists
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
  }

  // 2) Prompt the user for the insertion method
  const method = await hostEditor.showQuickPick(
    [
      { label: "Clipboard", description: "Paste image from clipboard", id: "clipboard" },
      { label: "File", description: "Pick an image file from disk", id: "file" },
      { label: "URL", description: "Download image from a URL", id: "url" },
    ],
    { placeHolder: "How do you want to insert the image?" },
  );

  if (!method) {
    return;
  }

  // Prompt for image name (default: timestamp)
  const defaultName = new Date().toISOString().replace(/[:.]/g, "-");
  const imageName = await hostEditor.showInputBox({
    prompt: "Name for the image (without extension)",
    value: defaultName,
    valueSelection: [0, defaultName.length],
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Image name cannot be empty";
      }
      if (/[<>:"/\\|?*]/.test(value)) {
        return "Image name contains invalid characters";
      }
      return undefined;
    },
  });

  if (!imageName) {
    return;
  }

  let savedFileName: string | undefined;

  switch (method.id) {
    case "clipboard":
      savedFileName = await imageFromClipboard(rsrcDir, imageName);
      break;
    case "file":
      savedFileName = await imageFromFile(rsrcDir, imageName);
      break;
    case "url":
      savedFileName = await imageFromUrl(rsrcDir, imageName);
      break;
  }

  if (!savedFileName) {
    return;
  }

  // Insert markdown image reference
  const relativePath = `.rsrc/${savedFileName}`;
  if (hostEditor.isActiveEditorDocumentEqualTo(document)) {
    const triggerRange = new Range(position.translate(0, -1), position);
    await hostEditor.replaceRange(triggerRange, `![${path.parse(savedFileName!).name}](${relativePath})`);
    await hostEditor.saveActiveDocument();
  }
}
