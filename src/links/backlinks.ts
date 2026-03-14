import { EventEmitter, Range, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "../hostEditor/EditorTypes";
import type { TextDocumentShowOptions, TreeDataProvider } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Regex } from "../core/regex";

// ── Backlinks TreeView ─────────────────────────────────────────────

interface BacklinkItem {
  /** The file that contains the link */
  sourceUri: Uri;
  /** The line number where the link appears */
  lineNumber: number;
  /** The full text of the line (trimmed) */
  lineText: string;
}

export class BacklinksProvider implements TreeDataProvider<BacklinkItem> {
  private _onDidChangeTreeData = new EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private currentUri: Uri | undefined;

  constructor() {
    // Refresh when active editor changes
    hostEditor.onDidChangeActiveTextEditor(() => this.refresh());

    // Refresh when any markdown file is saved (links may have changed)
    hostEditor.onDidSaveTextDocument((doc) => {
      if (doc.languageId === "markdown") {
        this.refresh();
      }
    });
  }

  refresh(): void {
    this.currentUri = hostEditor.getDocumentUri();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BacklinkItem): TreeItem {
    const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath ?? "";
    const relPath = path.relative(workspaceRoot, element.sourceUri.fsPath).replace(Regex.windowsSlash, "/");

    const item = new TreeItem(relPath, TreeItemCollapsibleState.None);

    item.description = `L${element.lineNumber + 1}: ${element.lineText}`;
    item.tooltip = element.lineText;
    item.iconPath = new ThemeIcon("file");

    // Clicking opens the file at the relevant line
    item.command = {
      title: "Open backlink",
      command: "vscode.open",
      arguments: [
        element.sourceUri,
        <TextDocumentShowOptions>{
          selection: new Range(element.lineNumber, 0, element.lineNumber, 0),
        },
      ],
    };

    return item;
  }

  async getChildren(): Promise<BacklinkItem[]> {
    if (!this.currentUri) {
      return [];
    }

    const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return [];
    }

    const currentFsPath = this.currentUri.fsPath;
    const currentRelative = path.relative(workspaceRoot, currentFsPath).replace(Regex.windowsSlash, "/");

    // Build a set of patterns to look for in link targets
    const searchPatterns = buildSearchPatterns(currentRelative, currentFsPath);

    if (searchPatterns.length === 0) {
      return [];
    }

    // Scan all markdown files for references
    const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
    const backlinks: BacklinkItem[] = [];

    for (const fileUri of mdFiles) {
      // Skip self
      if (fileUri.fsPath === currentFsPath) {
        continue;
      }

      try {
        const doc = await hostEditor.openTextDocument(fileUri);
        for (let i = 0; i < doc.lineCount; i++) {
          const lineText = doc.lineAt(i).text;

          if (searchPatterns.some((pat) => lineText.includes(pat))) {
            backlinks.push({
              sourceUri: fileUri,
              lineNumber: i,
              lineText: lineText.trim(),
            });
          }
        }
      } catch {
        // File may have been deleted between findFiles and open
      }
    }

    return backlinks;
  }
}

/**
 * Build a set of substrings to search for in markdown link targets.
 * We check several forms to maximise matching:
 * - Relative path from workspace root
 * - Just the filename
 * - Parent folder + filename (for `foo/index.md` → `foo/index.md`)
 */
function buildSearchPatterns(relPath: string, fsPath: string): string[] {
  const patterns = new Set<string>();

  // Full relative path (forward slashes)
  patterns.add(relPath);

  // Just the filename
  const baseName = path.basename(fsPath);
  if (baseName !== "index.md") {
    patterns.add(baseName);
  }

  // Parent/filename (e.g., `my-page/index.md`)
  const parentDir = path.basename(path.dirname(fsPath));
  if (parentDir && parentDir !== ".") {
    patterns.add(`${parentDir}/${baseName}`);
  }

  return Array.from(patterns);
}
