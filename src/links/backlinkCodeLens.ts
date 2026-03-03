import { hostEditor } from "../hostEditor/HostingEditor";
import { CodeLens, Disposable, EventEmitter, Range } from "../hostEditor/EditorTypes";
import type { CodeLensProvider, TextDocument } from "../hostEditor/EditorTypes";
import * as path from "path";
import { Cmd } from "../core/commands";

/**
 * CodeLens shown at the top of each markdown file indicating how many
 * other pages link to the current page.  Clicking the lens opens the
 * Backlinks panel.
 */

export class BacklinkCodeLensProvider implements CodeLensProvider {
  private _onDidChangeCodeLenses = new EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private cache: Map<string, number> = new Map();
  private disposables: Disposable[] = [];

  constructor() {
    // Rebuild cache when files change
    this.disposables.push(
      hostEditor.onDidSaveTextDocument(() => {
        this.rebuildCache();
        this._onDidChangeCodeLenses.fire();
      }),
    );
    this.rebuildCache();
  }

  private async rebuildCache(): Promise<void> {
    const files = await hostEditor.findFiles("**/*.md");
    const counts: Map<string, number> = new Map();

    for (const uri of files) {
      try {
        const doc = await hostEditor.openTextDocument(uri);
        const text = doc.getText();

        // Find markdown links [text](target)
        const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(text)) !== null) {
          const target = m[2];
          if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
            continue;
          }
          // Resolve relative to file's directory
          const dir = path.dirname(uri.fsPath);
          const resolved = path.resolve(dir, target.split("#")[0]);
          const norm = resolved.replace(/\\/g, "/").toLowerCase();
          counts.set(norm, (counts.get(norm) ?? 0) + 1);
        }
      } catch {
        // skip unreadable files
      }
    }
    this.cache = counts;
  }

  provideCodeLenses(document: TextDocument): CodeLens[] {
    if (document.languageId !== "markdown") {
      return [];
    }

    const norm = document.uri.fsPath.replace(/\\/g, "/").toLowerCase();
    const count = this.cache.get(norm) ?? 0;

    if (count === 0) {
      return [];
    }

    const range = new Range(0, 0, 0, 0);
    return [
      new CodeLens(range, {
        title: `↩ ${count} backlink${count === 1 ? "" : "s"}`,
        command: Cmd.focusBacklinks,
        tooltip: "Show backlinks panel",
      }),
    ];
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeCodeLenses.dispose();
  }
}

export function createBacklinkCodeLensProvider(): Disposable {
  const provider = new BacklinkCodeLensProvider();
  const reg = hostEditor.registerCodeLensProvider({ language: "markdown" }, provider);
  return Disposable.from(reg, provider);
}
