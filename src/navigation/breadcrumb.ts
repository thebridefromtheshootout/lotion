import { Disposable, StatusBarAlignment } from "../hostEditor/EditorTypes";
import type { StatusBarItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";

// ── Breadcrumb status bar item ─────────────────────────────────────
//
// Shows the page hierarchy in the status bar, e.g.:
//   📂 lotion-tests > movies > kill-bill-1
//
// Clicking it opens the heading picker (or parent page quick pick).

let statusBarItem: StatusBarItem | undefined;

export function createBreadcrumbStatusBar(): Disposable {
  statusBarItem = hostEditor.createStatusBarItem(StatusBarAlignment.Left, 50);
  statusBarItem.command = Cmd.jumpToHeading;
  statusBarItem.tooltip = "Click to jump to a heading";

  updateBreadcrumb();

  hostEditor.onDidChangeActiveTextEditor(() => updateBreadcrumb());
  const disposables: Disposable[] = [
    statusBarItem,
    hostEditor.onDidSaveTextDocument((doc) => {
      if (hostEditor.isActiveEditorDocumentEqualTo(doc)) {
        updateBreadcrumb();
      }
    }),
  ];

  return Disposable.from(...disposables);
}

function updateBreadcrumb(): void {
  if (!statusBarItem) {
    return;
  }

  if (!hostEditor.isMarkdownEditor()) {
    statusBarItem.hide();
    return;
  }

  const filePath = hostEditor.getDocumentUri()!.fsPath;
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    statusBarItem.hide();
    return;
  }

  const relativePath = path.relative(workspaceRoot, filePath).replace(Regex.windowsSlash, "/");
  const parts = relativePath.split("/");

  // Build breadcrumb from path segments, stripping noise:
  //   - Remove "index.md" filename (page is the folder)
  //   - Keep other .md filenames (without extension)
  const crumbs: string[] = [];
  for (const part of parts) {
    if (part === "index.md") {
      continue;
    }
    if (part.endsWith(".md")) {
      crumbs.push(part.slice(0, -3));
      continue;
    }
    crumbs.push(part);
  }

  if (crumbs.length === 0) {
    statusBarItem.hide();
    return;
  }

  // Prettify crumbs: kebab-case → Title Case
  const pretty = crumbs.map((c) => c.replace(Regex.dashUnderscore, " ").replace(Regex.wordBoundaryChar, (ch) => ch.toUpperCase()));

  statusBarItem.text = `$(folder) ${pretty.join(" $(chevron-right) ")}`;
  statusBarItem.show();
}
