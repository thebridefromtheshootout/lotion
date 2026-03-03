import { Disposable, EventEmitter, FileDecoration, Position, Range, Uri } from "../hostEditor/EditorTypes";
import type { FileDecorationProvider } from "../hostEditor/EditorTypes";
import { hostEditor, OpType, type EditOp } from "../hostEditor/HostingEditor";

/**
 * Read a page icon (emoji) from YAML frontmatter `icon:` field.
 * Provides a command to set/change the icon, and a
 * FileDecorationProvider to show icons in the Explorer tree.
 */

const ICON_RE = /^icon:\s*(.+)\s*$/m;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Extract the `icon:` value from a markdown document's frontmatter.
 * Returns undefined if not present.
 */
export function getPageIcon(text: string): string | undefined {
  const fm = FRONTMATTER_RE.exec(text);
  if (!fm) {
    return undefined;
  }
  const match = ICON_RE.exec(fm[1]);
  return match ? match[1].trim() : undefined;
}

/**
 * Set or update the `icon:` field in frontmatter.
 */
export async function setPageIcon(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const input = await hostEditor.showInputBox({
    prompt: "Enter an emoji icon for this page",
    placeHolder: "📝",
    value: getPageIcon(hostEditor.getDocumentText()) ?? "",
  });

  if (input === undefined) {
    return; // cancelled
  }

  const doc = hostEditor.getDocument()!;
  const text = hostEditor.getDocumentText();
  const fmMatch = FRONTMATTER_RE.exec(text);

  let op: EditOp | undefined;
  if (!fmMatch) {
    // No frontmatter — insert one
    if (input) {
      op = { type: OpType.Insert, position: new Position(0, 0), text: `---\nicon: ${input}\n---\n\n` };
    }
  } else {
    const fmContent = fmMatch[1];
    const iconMatch = ICON_RE.exec(fmContent);

    if (iconMatch) {
      // Replace existing icon line
      const fmStart = fmMatch.index + 4; // after "---\n"
      const lineStart = fmStart + (iconMatch.index ?? 0);
      const lineEnd = lineStart + iconMatch[0].length;
      const startPos = doc.positionAt(lineStart);
      const endPos = doc.positionAt(lineEnd);
      if (input) {
        op = { type: OpType.Replace, range: new Range(startPos, endPos), text: `icon: ${input}` };
      } else {
        // Remove the line (and trailing newline)
        const deleteEnd = lineEnd < text.length && text[lineEnd] === "\n" ? lineEnd + 1 : lineEnd;
        op = { type: OpType.Delete, range: new Range(startPos, doc.positionAt(deleteEnd)) };
      }
    } else if (input) {
      // Add icon line to existing frontmatter
      const insertPos = doc.positionAt(fmMatch.index + 4); // after "---\n"
      op = { type: OpType.Insert, position: insertPos, text: `icon: ${input}\n` };
    }
  }
  if (op) {
    await hostEditor.batchEdit([op]);
  }
}

/**
 * FileDecorationProvider that shows page icon emojis as badges
 * in the Explorer tree.
 */
export class PageIconDecorationProvider implements FileDecorationProvider {
  private _onDidChangeFileDecorations = new EventEmitter<Uri | Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private disposables: Disposable[] = [];

  constructor() {
    this.disposables.push(
      hostEditor.onDidSaveTextDocument(() => {
        this._onDidChangeFileDecorations.fire(undefined);
      }),
    );
  }

  async provideFileDecoration(uri: Uri): Promise<FileDecoration | undefined> {
    if (!uri.fsPath.endsWith(".md")) {
      return undefined;
    }

    try {
      const doc = await hostEditor.openTextDocument(uri);
      const icon = getPageIcon(doc.getText());
      if (icon) {
        return new FileDecoration(
          icon.substring(0, 2), // badge (max 2 chars)
          `Page icon: ${icon}`,
        );
      }
    } catch {
      // file not readable
    }

    return undefined;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeFileDecorations.dispose();
  }
}

export function createPageIconProvider(): Disposable {
  const provider = new PageIconDecorationProvider();
  hostEditor.registerFileDecorationProvider(provider);
  return Disposable.from(provider);
}
