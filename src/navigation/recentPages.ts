import { Disposable } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Regex } from "../core/regex";

/**
 * Tracks recently visited markdown pages and provides a quick-pick
 * navigator (distinct from VS Code's native "Go Back" which works at
 * the cursor-position level).
 */

const MAX_HISTORY = 50;
const history: string[] = []; // fsPath values, most recent first
let disposables: Disposable[] = [];

function addToHistory(fsPath: string): void {
  const idx = history.indexOf(fsPath);
  if (idx !== -1) {
    history.splice(idx, 1);
  }
  history.unshift(fsPath);
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
}

export function createRecentPagesTracker(): Disposable {
  hostEditor.onDidChangeActiveTextEditor(() => {
    if (hostEditor.isMarkdownEditor()) {
      const docUri = hostEditor.getDocumentUri();
      if (docUri) {
        addToHistory(docUri.fsPath);
      }
    }
  });

  // Seed with current editor
  if (hostEditor.isMarkdownEditor()) {
    const docUri = hostEditor.getDocumentUri();
    if (docUri) {
      addToHistory(docUri.fsPath);
    }
  }

  return Disposable.from(...disposables);
}

export async function showRecentPages(): Promise<void> {
  if (history.length === 0) {
    hostEditor.showInformation("No recently visited pages.");
    return;
  }

  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath ?? "";

  const items = history.map((fsPath) => {
    const rel = workspaceRoot ? path.relative(workspaceRoot, fsPath).replace(Regex.windowsSlash, "/") : path.basename(fsPath);

    // Derive page title from relative path
    const parts = rel.replace(Regex.trailingIndexMd, "").split("/");
    const label = parts[parts.length - 1] || rel;

    return {
      label,
      description: rel,
      fsPath,
    };
  });

  const picked = await hostEditor.showQuickPick(items, {
    placeHolder: "Recent pages (most recent first)",
    matchOnDescription: true,
  });

  if (picked) {
    const doc = await hostEditor.openTextDocument(picked.fsPath);
    await hostEditor.showTextDocument(doc);
  }
}
