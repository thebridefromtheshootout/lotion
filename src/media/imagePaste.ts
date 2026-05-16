import { hostEditor } from "../hostEditor/HostingEditor";
import {
  Disposable,
  DocumentDropOrPasteEditKind,
  DocumentPasteEdit,
} from "../hostEditor/EditorTypes";
import type {
  CancellationToken,
  DataTransfer,
  DocumentPasteEditContext,
  Range,
  TextDocument,
} from "../hostEditor/EditorTypes";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Regex } from "../core/regex";

// Native paste-edit provider for clipboard images.
//
// Replaces the powershell.exe / wslpath / xclip shell-out path. The
// provider receives image bytes directly from VS Code's renderer, so
// WSL never reaches across the 9P boundary and macOS / Linux never
// shell out either. The old src/media/clipboard.ts is retained as a
// fallback for VS Code versions older than 1.97 (when this API
// stabilised).

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

const PASTE_MIME_TYPES = Object.keys(MIME_TO_EXT);

let providerActive = false;

/** True once the native paste provider has been successfully registered. */
export function isImagePasteProviderActive(): boolean {
  return providerActive;
}

function buildImageKind(): DocumentDropOrPasteEditKind | undefined {
  const empty = DocumentDropOrPasteEditKind?.Empty;
  if (!empty || typeof empty.append !== "function") {
    return undefined;
  }
  return empty.append("image", "markdown");
}

export function createImagePasteProvider(): Disposable {
  // Feature-detect — DocumentPasteEdit API became stable in VS Code 1.97.
  // Older hosts will hit the older clipboard shell-out path.
  if (typeof (DocumentPasteEdit as unknown) !== "function") {
    return Disposable.from();
  }
  const imageKind = buildImageKind();
  if (!imageKind) {
    return Disposable.from();
  }

  const disp = hostEditor.registerDocumentPasteEditProvider(
    { language: "markdown" },
    {
      async provideDocumentPasteEdits(
        _document: TextDocument,
        _ranges: readonly Range[],
        dataTransfer: DataTransfer,
        _ctx: DocumentPasteEditContext,
        token: CancellationToken,
      ): Promise<DocumentPasteEdit[] | undefined> {
        let ext: string | undefined;
        let item: ReturnType<DataTransfer["get"]> | undefined;
        for (const mime of PASTE_MIME_TYPES) {
          const candidate = dataTransfer.get(mime);
          if (candidate) {
            item = candidate;
            ext = MIME_TO_EXT[mime];
            break;
          }
        }
        if (!item || !ext) {
          return undefined;
        }

        const cwd = getCwd();
        if (!cwd) {
          return undefined;
        }

        const file = item.asFile();
        if (!file || token.isCancellationRequested) {
          return undefined;
        }
        const bytes = await file.data();
        if (token.isCancellationRequested) {
          return undefined;
        }

        const defaultName = new Date().toISOString().replace(Regex.colonDot, "-");
        const imageName = await hostEditor.showInputBox({
          prompt: "Name for the image (without extension)",
          value: defaultName,
          valueSelection: [0, defaultName.length],
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Image name cannot be empty";
            }
            if (Regex.invalidPathChars.test(value)) {
              return "Image name contains invalid characters";
            }
            return undefined;
          },
        });
        if (!imageName) {
          return undefined;
        }

        const rsrcDir = path.join(cwd, ".rsrc");
        if (!fs.existsSync(rsrcDir)) {
          fs.mkdirSync(rsrcDir, { recursive: true });
        }

        let destName = `${imageName}.${ext}`;
        let counter = 1;
        while (fs.existsSync(path.join(rsrcDir, destName))) {
          destName = `${imageName}-${counter}.${ext}`;
          counter++;
        }
        fs.writeFileSync(path.join(rsrcDir, destName), Buffer.from(bytes));

        const altEscaped = imageName.replace(Regex.doubleQuote, "&quot;");
        const snippet = `<img src=".rsrc/${destName}" alt="${altEscaped}">`;
        return [new DocumentPasteEdit(snippet, "Save clipboard image", imageKind)];
      },
    },
    {
      providedPasteEditKinds: [imageKind],
      pasteMimeTypes: PASTE_MIME_TYPES,
    },
  );

  providerActive = true;
  return disp;
}
