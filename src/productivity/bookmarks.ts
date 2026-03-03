import { Disposable, EventEmitter, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "../hostEditor/EditorTypes";
import type { TreeDataProvider } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { TreeView } from "../core/commands";

/**
 * Bookmark / pin system for frequently-accessed pages.
 *
 * Stores bookmarks in `.vscode/lotion-bookmarks.json`.
 * Provides a TreeDataProvider for the sidebar plus commands to
 * add / remove / open bookmarks.
 */

interface BookmarkEntry {
  /** workspace-relative path */
  path: string;
  /** optional display label */
  label?: string;
}

function getBookmarksFile(): string | undefined {
  const root = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  return path.join(root, ".vscode", "lotion-bookmarks.json");
}

function loadBookmarks(): BookmarkEntry[] {
  const file = getBookmarksFile();
  if (!file || !fs.existsSync(file)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
}

function saveBookmarks(entries: BookmarkEntry[]): void {
  const file = getBookmarksFile();
  if (!file) {
    return;
  }
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(entries, null, 2), "utf-8");
}

export async function bookmarkPage(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    hostEditor.showWarning("Open a markdown file to bookmark it.");
    return;
  }
  const docUri = hostEditor.getDocumentUri();
  if (!docUri) {
    return;
  }
  const root = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!root) {
    return;
  }

  const relPath = path.relative(root, docUri.fsPath).replace(/\\/g, "/");
  const bookmarks = loadBookmarks();

  if (bookmarks.some((b) => b.path === relPath)) {
    hostEditor.showInformation("Page is already bookmarked.");
    return;
  }

  bookmarks.push({ path: relPath });
  saveBookmarks(bookmarks);
  hostEditor.showInformation(`Bookmarked: ${relPath}`);
  bookmarkTreeProvider?.refresh();
}

export async function removeBookmark(): Promise<void> {
  const bookmarks = loadBookmarks();
  if (bookmarks.length === 0) {
    hostEditor.showInformation("No bookmarks to remove.");
    return;
  }

  const items = bookmarks.map((b) => ({
    label: b.label || path.basename(b.path, ".md"),
    description: b.path,
    entry: b,
  }));

  const picked = await hostEditor.showQuickPick(items, {
    placeHolder: "Select bookmark to remove",
  });

  if (!picked) {
    return;
  }

  const filtered = bookmarks.filter((b) => b.path !== picked.entry.path);
  saveBookmarks(filtered);
  hostEditor.showInformation(`Removed bookmark: ${picked.entry.path}`);
  bookmarkTreeProvider?.refresh();
}

export async function openBookmark(): Promise<void> {
  const bookmarks = loadBookmarks();
  if (bookmarks.length === 0) {
    hostEditor.showInformation("No bookmarks yet. Use 'Lotion: Bookmark Page' to add one.");
    return;
  }

  const root = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath ?? "";
  const items = bookmarks.map((b) => ({
    label: b.label || path.basename(b.path, ".md"),
    description: b.path,
    fsPath: path.join(root, b.path),
  }));

  const picked = await hostEditor.showQuickPick(items, {
    placeHolder: "Open bookmarked page",
    matchOnDescription: true,
  });

  if (picked) {
    const doc = await hostEditor.openTextDocument(picked.fsPath);
    await hostEditor.showTextDocument(doc);
  }
}

// ── Tree view ──────────────────────────────────────────────────────

let bookmarkTreeProvider: BookmarkTreeProvider | undefined;

class BookmarkTreeProvider implements TreeDataProvider<BookmarkEntry> {
  private _onDidChange = new EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: BookmarkEntry): TreeItem {
    const label = element.label || path.basename(element.path, ".md");
    const item = new TreeItem(label, TreeItemCollapsibleState.None);
    item.description = element.path;
    item.tooltip = element.path;
    item.iconPath = new ThemeIcon("bookmark");
    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [Uri.file(path.join(hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath ?? "", element.path))],
    };
    return item;
  }

  getChildren(): BookmarkEntry[] {
    return loadBookmarks();
  }
}

export function createBookmarkTreeView(): Disposable {
  bookmarkTreeProvider = new BookmarkTreeProvider();
  const treeView = hostEditor.createTreeView(TreeView.bookmarks, {
    treeDataProvider: bookmarkTreeProvider,
  });
  return treeView;
}
