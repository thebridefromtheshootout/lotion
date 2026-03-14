import { hostEditor } from "../hostEditor/HostingEditor";
import { CompletionItem, CompletionItemKind, Disposable, Position, Range, Uri } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import * as path from "path";
import { Regex } from "../core/regex";

/**
 * [[ link autocomplete – CompletionItemProvider triggered by `[`.
 *
 * When the user types `[[`, the provider finds all markdown files in the
 * workspace and offers them as wiki-style link completions.  Selecting an
 * item inserts a standard markdown link: `[Page Title](relative/path.md)`.
 */
export function createLinkCompletionProvider(): Disposable {
  return hostEditor.registerCompletionItemProvider(
    { language: "markdown" },
    {
      async provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[] | undefined> {
        // Only trigger after `[[`
        const lineText = document.lineAt(position).text;
        const before = lineText.substring(0, position.character);
        if (!before.endsWith("[[")) {
          return undefined;
        }

        // Find all markdown files in the workspace
        const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");

        if (mdFiles.length === 0) {
          return undefined;
        }

        const currentDir = path.dirname(document.uri.fsPath);

        const items: CompletionItem[] = mdFiles
          .filter((uri) => uri.fsPath !== document.uri.fsPath) // exclude self
          .map((uri) => {
            // Derive a human-readable title from the file path
            const title = deriveTitle(uri);
            const relativePath = path.relative(currentDir, uri.fsPath).replace(Regex.windowsSlash, "/");

            const item = new CompletionItem(title, CompletionItemKind.File);
            item.detail = relativePath;
            item.filterText = `[[${title}`;
            item.sortText = title.toLowerCase();

            // Replace the `[[` trigger (and any auto-closed `]]`) with a markdown link
            const replaceStart = position.translate(0, -2); // consume `[[`
            const after = lineText.substring(position.character);
            const extraConsume = after.startsWith("]]") ? 2 : after.startsWith("]") ? 1 : 0;
            const replaceEnd = position.translate(0, extraConsume);
            item.range = new Range(replaceStart, replaceEnd);
            item.insertText = `[${title}](${relativePath})`;

            return item;
          });

        return items;
      },
    },
    "[", // trigger character
  );
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Derive a human-readable title from a markdown file URI.
 *
 * - `my-page/index.md` → "My Page"
 * - `notes.md`                  → "Notes"
 * - `some-doc.md`               → "Some Doc"
 */
function deriveTitle(uri: Uri): string {
  const parsed = path.parse(uri.fsPath);

  // For index.md, use the parent directory name
  const baseName = parsed.name.toLowerCase() === "index" ? path.basename(path.dirname(uri.fsPath)) : parsed.name;

  // Convert kebab/snake case to title case
  return baseName.replace(Regex.dashUnderscore, " ").replace(Regex.wordBoundaryChar, (c) => c.toUpperCase());
}
