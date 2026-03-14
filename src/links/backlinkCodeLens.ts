import { hostEditor } from "../hostEditor/HostingEditor";
import { CodeLens, Disposable, EventEmitter, Range } from "../hostEditor/EditorTypes";
import type { CodeLensProvider, TextDocument, Uri } from "../hostEditor/EditorTypes";
import * as fs from "fs";
import * as path from "path";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";

/**
 * CodeLens shown at the top of each markdown file indicating how many
 * other pages link to the current page.  Clicking the lens opens the
 * Backlinks panel.
 */

export class BacklinkCodeLensProvider implements CodeLensProvider {
  private _onDidChangeCodeLenses = new EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private cache: Map<string, { sourceUri: Uri; line: number }[]> = new Map();
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

  private normalizePath(filePath: string): string {
    const normalized = filePath.replace(Regex.windowsSlash, "/");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  }

  private isExternalTarget(target: string): boolean {
    return (
      Regex.httpOrMailtoOrAnchor.test(target) ||
      target.startsWith("data:") ||
      target.startsWith("file:") ||
      target.startsWith("//")
    );
  }

  private splitTarget(target: string): { pathPart: string; suffix: string } {
    const idx = target.search(Regex.queryOrHashMarker);
    if (idx === -1) {
      return { pathPart: target, suffix: "" };
    }
    return {
      pathPart: target.slice(0, idx),
      suffix: target.slice(idx),
    };
  }

  private resolveCandidateTargets(pathPart: string, sourceDir: string, workspaceRoot: string): string[] {
    const bases: string[] = [];

    if (pathPart.startsWith("/")) {
      bases.push(path.resolve(workspaceRoot, "." + pathPart));
    } else {
      bases.push(path.resolve(sourceDir, pathPart));
      // Support workspace-root style links such as "docs/page/index.md".
      if (!pathPart.startsWith("./") && !pathPart.startsWith("../")) {
        bases.push(path.resolve(workspaceRoot, pathPart));
      }
    }

    const expanded = new Set<string>();
    for (const base of bases) {
      expanded.add(base);
      if (fs.existsSync(base)) {
        try {
          if (fs.statSync(base).isDirectory()) {
            expanded.add(path.join(base, "index.md"));
          }
        } catch {
          // ignore unreadable path
        }
      } else if (!path.extname(base)) {
        expanded.add(`${base}.md`);
      }
    }

    return Array.from(expanded);
  }

  private async rebuildCache(): Promise<void> {
    const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      this.cache = new Map();
      return;
    }

    const files = await hostEditor.findFiles("**/*.md");
    const backlinks: Map<string, { sourceUri: Uri; line: number }[]> = new Map();

    for (const uri of files) {
      try {
        const doc = await hostEditor.openTextDocument(uri);
        const sourceDir = path.dirname(uri.fsPath);

        for (let line = 0; line < doc.lineCount; line++) {
          const lineText = doc.lineAt(line).text;
          const linkRe = new RegExp(Regex.markdownLinkGlobal.source, "g");
          let m: RegExpExecArray | null;
          while ((m = linkRe.exec(lineText)) !== null) {
            // Skip images
            if (m.index > 0 && lineText[m.index - 1] === "!") {
              continue;
            }

            const { pathPart } = this.splitTarget(m[2]);
            if (!pathPart || this.isExternalTarget(pathPart)) {
              continue;
            }

            for (const resolved of this.resolveCandidateTargets(pathPart, sourceDir, workspaceRoot)) {
              const norm = this.normalizePath(resolved);
              if (!backlinks.has(norm)) {
                backlinks.set(norm, []);
              }
              backlinks.get(norm)!.push({ sourceUri: uri, line });
            }
          }
        }
      } catch {
        // skip unreadable files
      }
    }
    this.cache = backlinks;
  }

  provideCodeLenses(document: TextDocument): CodeLens[] {
    if (document.languageId !== "markdown") {
      return [];
    }

    const norm = this.normalizePath(document.uri.fsPath);
    const refs = this.cache.get(norm) ?? [];
    const count = refs.length;

    if (count === 0) {
      return [];
    }

    const range = new Range(0, 0, 0, 0);
    if (count === 1) {
      const only = refs[0];
      return [
        new CodeLens(range, {
          title: "↩ 1 backlink",
          command: "vscode.open",
          tooltip: "Open the page containing the backlink",
          arguments: [
            only.sourceUri,
            {
              selection: new Range(only.line, 0, only.line, 0),
              preview: false,
            },
          ],
        }),
      ];
    }

    return [
      new CodeLens(range, {
        title: `↩ ${count} backlinks`,
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
