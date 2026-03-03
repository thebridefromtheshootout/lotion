import { Position, Range, WorkspaceEdit } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";

// ── Rename page with link refactoring ──────────────────────────────
//
// Renames the current page's folder and updates all markdown links
// across the workspace that point to it.

export async function renamePage(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    hostEditor.showWarning("Open a markdown file to rename.");
    return;
  }

  const currentUri = hostEditor.getDocumentUri();
  if (!currentUri) {
    return;
  }
  const currentPath = currentUri.fsPath;
  const currentDir = path.dirname(currentPath);
  const currentFileName = path.basename(currentPath);

  // Only makes sense for index.md pages in the lotion structure
  if (currentFileName.toLowerCase() !== "index.md") {
    hostEditor.showWarning("Rename is for index.md page files.");
    return;
  }

  const currentFolderName = path.basename(currentDir);
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  const newName = await hostEditor.showInputBox({
    prompt: "New page name",
    value: currentFolderName,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Name cannot be empty";
      }
      if (/[<>:"/\\|?*]/.test(value)) {
        return "Contains invalid characters";
      }
      return undefined;
    },
  });

  if (!newName || newName === currentFolderName) {
    return;
  }

  const newFolderName = newName.toLowerCase().replace(/\s+/g, "-");
  const parentDir = path.dirname(currentDir);
  const newDir = path.join(parentDir, newFolderName);

  if (fs.existsSync(newDir)) {
    hostEditor.showError(`Folder '${newFolderName}' already exists.`);
    return;
  }

  // Compute old and new relative paths for link updates
  const oldRelFromRoot = path.relative(workspaceRoot, currentDir).replace(/\\/g, "/");
  const newRelFromRoot = path.relative(workspaceRoot, newDir).replace(/\\/g, "/");

  // Close the current document first
  await hostEditor.executeCommand("workbench.action.closeActiveEditor");

  // Rename the folder
  fs.renameSync(currentDir, newDir);

  // Update all markdown links across workspace
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  let updatedCount = 0;

  for (const uri of mdFiles) {
    try {
      const doc = await hostEditor.openTextDocument(uri);
      const text = doc.getText();

      // Replace any path reference containing the old folder name
      const escaped = oldRelFromRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "g");

      if (re.test(text)) {
        const newText = text.replace(re, newRelFromRoot);
        const edit = new WorkspaceEdit();
        const fullRange = new Range(
          new Position(0, 0),
          new Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length),
        );
        edit.replace(uri, fullRange, newText);
        await hostEditor.applyWorkspaceEdit(edit);
        await doc.save();
        updatedCount++;
      }
    } catch {
      // skip
    }
  }

  // Update the heading in the renamed page's index.md
  const newIndexPath = path.join(newDir, "index.md");
  if (fs.existsSync(newIndexPath)) {
    const doc = await hostEditor.openTextDocument(newIndexPath);
    const text = doc.getText();
    const titleCase = newName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Update H1 heading if it matches old name
    const oldTitle = currentFolderName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (text.includes(`# ${oldTitle}`)) {
      const newText = text.replace(`# ${oldTitle}`, `# ${titleCase}`);
      const edit = new WorkspaceEdit();
      const fullRange = new Range(
        new Position(0, 0),
        new Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length),
      );
      edit.replace(doc.uri, fullRange, newText);
      await hostEditor.applyWorkspaceEdit(edit);
      await doc.save();
    }

    // Open the renamed file
    await hostEditor.showTextDocument(doc);
  }

  hostEditor.showInformation(`Renamed to '${newFolderName}'. Updated ${updatedCount} file(s).`);
}
