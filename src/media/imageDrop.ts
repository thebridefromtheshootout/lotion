import { hostEditor } from "../hostEditor/HostingEditor";
import { Disposable, DocumentDropEdit, Position, Uri } from "../hostEditor/EditorTypes";
import type { CancellationToken, DataTransfer, TextDocument } from "../hostEditor/EditorTypes";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);

// ── Collect image URIs from a data transfer ────────────────────────
function extractImageUris(uriListStr: string): { filePath: string; ext: string }[] {
  const results: { filePath: string; ext: string }[] = [];
  for (const rawUri of uriListStr.split("\n")) {
    const trimmed = rawUri.trim();
    if (!trimmed) {
      continue;
    }
    let fsPath: string;
    try {
      fsPath = Uri.parse(trimmed).fsPath;
    } catch {
      continue;
    }
    const ext = path.extname(fsPath).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      results.push({ filePath: fsPath, ext });
    }
  }
  return results;
}

// ── Prompt, copy, and build markdown for one image ─────────────────
async function processDroppedImage(srcPath: string, rsrcDir: string): Promise<string | undefined> {
  const originalParsed = path.parse(path.basename(srcPath));
  const defaultName = originalParsed.name;
  const ext = originalParsed.ext;

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
    return undefined;
  }

  // Ensure .rsrc/ exists
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
  }

  let destName = `${imageName}${ext}`;

  // Avoid overwriting existing files
  let counter = 1;
  while (fs.existsSync(path.join(rsrcDir, destName))) {
    destName = `${imageName}-${counter}${ext}`;
    counter++;
  }

  // Copy the image into .rsrc/
  fs.copyFileSync(srcPath, path.join(rsrcDir, destName));

  return `![${imageName}](.rsrc/${destName})`;
}

// ── Drag-and-drop image provider ───────────────────────────────────
export function createImageDropProvider(): Disposable {
  return hostEditor.registerDocumentDropEditProvider(
    { language: "markdown" },
    {
      async provideDocumentDropEdits(
        document: TextDocument,
        position: Position,
        dataTransfer: DataTransfer,
        token: CancellationToken,
      ): Promise<DocumentDropEdit | undefined> {
        const filesItem = dataTransfer.get("text/uri-list");
        if (!filesItem) {
          return undefined;
        }

        const uriList = await filesItem.asString();
        if (token.isCancellationRequested) {
          return undefined;
        }

        const cwd = getCwd();
        if (!cwd) {
          return undefined;
        }

        const images = extractImageUris(uriList);
        if (images.length === 0) {
          return undefined;
        }

        const rsrcDir = path.join(cwd, ".rsrc");
        const snippetParts: string[] = [];

        for (const img of images) {
          if (token.isCancellationRequested) {
            return undefined;
          }
          const snippet = await processDroppedImage(img.filePath, rsrcDir);
          if (!snippet) {
            return undefined; // user cancelled
          }
          snippetParts.push(snippet);
        }

        if (snippetParts.length === 0) {
          return undefined;
        }

        const edit = new DocumentDropEdit(snippetParts.join("\n\n"));
        return edit;
      },
    },
  );
}
