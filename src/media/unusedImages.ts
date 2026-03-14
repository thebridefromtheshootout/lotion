import { Uri } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Regex } from "../core/regex";

// ── Unused images detector ─────────────────────────────────────────
//
// Scans all .rsrc/ directories for image files, checks if each is
// referenced from any markdown file, and lists orphaned images.

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico"]);

export async function findUnusedImages(): Promise<void> {
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    hostEditor.showWarning("No workspace folder open.");
    return;
  }

  // Find all image files in any .rsrc/ folder
  const imageFiles = await hostEditor.findFiles("**/.rsrc/**", "**/node_modules/**");
  const images = imageFiles.filter((f) => IMAGE_EXTS.has(path.extname(f.fsPath).toLowerCase()));

  if (images.length === 0) {
    hostEditor.showInformation("No image files found in .rsrc/ directories.");
    return;
  }

  // Collect all text from markdown files
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  let allMdText = "";
  for (const uri of mdFiles) {
    try {
      const doc = await hostEditor.openTextDocument(uri);
      allMdText += doc.getText() + "\n";
    } catch {
      // skip
    }
  }

  // Check which images are not referenced
  const unused: { label: string; detail: string; uri: Uri }[] = [];

  for (const imgUri of images) {
    const filename = path.basename(imgUri.fsPath);
    // Check if filename appears anywhere in markdown text
    if (!allMdText.includes(filename)) {
      const relPath = path.relative(workspaceRoot, imgUri.fsPath).replace(Regex.windowsSlash, "/");
      unused.push({
        label: filename,
        detail: relPath,
        uri: imgUri,
      });
    }
  }

  if (unused.length === 0) {
    hostEditor.showInformation("All images are referenced — no orphans found!");
    return;
  }

  unused.sort((a, b) => a.label.localeCompare(b.label));

  const action = await hostEditor.showQuickPick(
    [
      { label: "$(list-unordered) View unused images", value: "view" as const },
      { label: "$(trash) Delete all unused images", value: "delete" as const },
    ],
    { placeHolder: `${unused.length} unused image(s) found` },
  );

  if (!action) {
    return;
  }

  if (action.value === "delete") {
    const confirm = await hostEditor.showWarningModal(
      `Delete ${unused.length} unused image(s)? This cannot be undone.`,
      ["Delete"],
    );
    if (confirm !== "Delete") {
      return;
    }

    for (const img of unused) {
      try {
        await hostEditor.deleteFile(img.uri);
      } catch {
        // skip failures
      }
    }
    hostEditor.showInformation(`Deleted ${unused.length} unused image(s).`);
    return;
  }

  // View mode: show in quick pick, open on select
  const pick = await hostEditor.showQuickPick(unused, {
    placeHolder: "Select to reveal in explorer",
    matchOnDetail: true,
  });

  if (pick) {
    await hostEditor.executeCommand("revealInExplorer", pick.uri);
  }
}
