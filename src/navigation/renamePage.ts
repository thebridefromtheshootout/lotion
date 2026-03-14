import { Position, Range, WorkspaceEdit } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import { toKebabCaseLower } from "../core/slug";
import type { SlashCommand } from "../core/slashCommands";
import { relinkWorkspacePagePaths } from "./pageRelink";

export const RENAME_PAGE_SLASH_COMMAND: SlashCommand = {
  label: "/rename-page",
  insertText: "",
  detail: "✏️ Rename current page folder and update links",
  isAction: true,
  commandId: Cmd.renamePage,
  kind: 2,
  handler: async () => renamePage(),
};

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
      if (Regex.invalidPathChars.test(value)) {
        return "Contains invalid characters";
      }
      return undefined;
    },
  });

  if (!newName || newName === currentFolderName) {
    return;
  }

  const newFolderName = toKebabCaseLower(newName);
  const parentDir = path.dirname(currentDir);
  const newDir = path.join(parentDir, newFolderName);

  if (fs.existsSync(newDir)) {
    hostEditor.showError(`Folder '${newFolderName}' already exists.`);
    return;
  }

  // Compute old and new relative paths for link updates
  const oldRelFromRoot = path.relative(workspaceRoot, currentDir).replace(Regex.windowsSlash, "/");
  const newRelFromRoot = path.relative(workspaceRoot, newDir).replace(Regex.windowsSlash, "/");

  // Close the current document first
  await hostEditor.executeCommand("workbench.action.closeActiveEditor");

  // Rename the folder
  fs.renameSync(currentDir, newDir);

  // Update all markdown links/backlinks across workspace
  const updatedCount = await relinkWorkspacePagePaths(oldRelFromRoot, newRelFromRoot);

  // Update the heading in the renamed page's index.md
  const newIndexPath = path.join(newDir, "index.md");
  if (fs.existsSync(newIndexPath)) {
    const doc = await hostEditor.openTextDocument(newIndexPath);
    const text = doc.getText();
    const desiredTitle = newName.trim();
    const lines = text.split(Regex.lineBreakSplit);
    const firstH1Index = lines.findIndex((line) => {
      const m = line.match(Regex.headingLineWithText);
      return !!m && m[1].length === 1;
    });

    if (firstH1Index >= 0) {
      lines[firstH1Index] = `# ${desiredTitle}`;
      const newText = lines.join("\n");
      if (newText !== text) {
        const edit = new WorkspaceEdit();
        const fullRange = new Range(
          new Position(0, 0),
          new Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length),
        );
        edit.replace(doc.uri, fullRange, newText);
        await hostEditor.applyWorkspaceEdit(edit);
        await doc.save();
      }
    } else {
      const prefix = text.length > 0 ? "\n\n" : "";
      const newText = `# ${desiredTitle}${prefix}${text}`;
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
