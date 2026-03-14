import { Uri } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Regex } from "../core/regex";

// ── Orphan page finder ─────────────────────────────────────────────
//
// Scans the workspace for markdown pages that are not linked from any
// other page. Presents them in a quick pick for easy navigation.

export async function findOrphanPages(): Promise<void> {
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    hostEditor.showWarning("No workspace folder open.");
    return;
  }

  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  if (mdFiles.length === 0) {
    hostEditor.showInformation("No markdown files found.");
    return;
  }

  // Build a set of all referenced paths (normalized, relative to workspace root)
  const referenced = new Set<string>();

  // Patterns that capture link targets in markdown
  const linkRe = Regex.markdownLinkGlobal;

  for (const fileUri of mdFiles) {
    try {
      const doc = await hostEditor.openTextDocument(fileUri);
      const text = doc.getText();
      let match: RegExpExecArray | null;
      linkRe.lastIndex = 0;

      while ((match = linkRe.exec(text)) !== null) {
        const target = match[2].split("#")[0].split("?")[0].trim(); // strip anchors/params
        if (!target || target.startsWith("http://") || target.startsWith("https://")) {
          continue;
        }

        // Resolve relative to the file's directory
        const fileDir = path.dirname(fileUri.fsPath);
        const absTarget = path.resolve(fileDir, target);
        const relTarget = path.relative(workspaceRoot, absTarget).replace(Regex.windowsSlash, "/");
        referenced.add(relTarget.toLowerCase());
      }
    } catch {
      // skip unreadable files
    }
  }

  // Find orphans: files not in the referenced set
  const orphans: { label: string; detail: string; uri: Uri }[] = [];

  for (const fileUri of mdFiles) {
    const relPath = path.relative(workspaceRoot, fileUri.fsPath).replace(Regex.windowsSlash, "/");

    // Skip if this file is referenced
    if (referenced.has(relPath.toLowerCase())) {
      continue;
    }

    // Skip the workspace root index.md — it's the entry point
    if (relPath === "index.md") {
      continue;
    }

    const title = deriveTitle(fileUri);
    orphans.push({
      label: title,
      detail: relPath,
      uri: fileUri,
    });
  }

  if (orphans.length === 0) {
    hostEditor.showInformation("No orphan pages found — all pages are linked!");
    return;
  }

  orphans.sort((a, b) => a.label.localeCompare(b.label));

  const pick = await hostEditor.showQuickPick(orphans, {
    placeHolder: `${orphans.length} orphan page(s) found — select to open`,
    matchOnDetail: true,
  });

  if (pick) {
    const doc = await hostEditor.openTextDocument(pick.uri);
    await hostEditor.showTextDocument(doc);
  }
}

function deriveTitle(uri: Uri): string {
  const parsed = path.parse(uri.fsPath);
  const baseName = parsed.name.toLowerCase() === "index" ? path.basename(path.dirname(uri.fsPath)) : parsed.name;
  return baseName.replace(Regex.dashUnderscore, " ").replace(Regex.wordBoundaryChar, (c) => c.toUpperCase());
}
