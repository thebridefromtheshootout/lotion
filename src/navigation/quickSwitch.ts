import { Uri } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";

// ── Quick page switcher ────────────────────────────────────────────
//
// Ctrl+P-like quick pick that's filtered to markdown pages.
// Shows titles derived from filenames with path context.

export async function quickSwitchPage(): Promise<void> {
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  if (mdFiles.length === 0) {
    hostEditor.showInformation("No markdown pages found.");
    return;
  }

  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath || "";

  const items = mdFiles.map((uri) => {
    const relPath = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, "/");
    return {
      label: deriveTitle(uri),
      description: relPath,
      uri,
    };
  });

  items.sort((a, b) => a.label.localeCompare(b.label));

  const pick = await hostEditor.showQuickPick(items, {
    placeHolder: "Switch to page…",
    matchOnDescription: true,
  });

  if (pick) {
    const doc = await hostEditor.openTextDocument(pick.uri);
    await hostEditor.showTextDocument(doc);
  }
}

function deriveTitle(uri: Uri): string {
  const parsed = path.parse(uri.fsPath);
  const baseName = parsed.name.toLowerCase() === "index" ? path.basename(path.dirname(uri.fsPath)) : parsed.name;
  return baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
