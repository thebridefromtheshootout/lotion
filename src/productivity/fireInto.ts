import * as path from "path";
import { Uri, WorkspaceEdit } from "vscode";
import { hostEditor } from "../hostEditor/HostingEditor";

export async function fireInto(): Promise<void> {
  // 1. Get all markdown files
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  if (mdFiles.length === 0) {
    hostEditor.showInformation("No markdown pages found.");
    return;
  }

  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath || "";

  const items = mdFiles.map((uri: Uri) => {
    const relPath = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, "/");
    return {
      label: deriveTitle(uri),
      description: relPath,
      uri,
    };
  });

  items.sort((a, b) => a.label.localeCompare(b.label));

  const pick = await hostEditor.showQuickPick(items, {
    placeHolder: "Fire clipboard into...",
    matchOnDescription: true,
  });

  if (pick) {
    const text = await hostEditor.readClipboardText();
    if (!text) {
      hostEditor.showWarning("Clipboard is empty.");
      return;
    }

    const doc = await hostEditor.openTextDocument(pick.uri);
    const existingText = doc.getText();
    const needsNewline = existingText.length > 0 && !existingText.endsWith("\n");
    const appendText = (needsNewline ? "\n" : "") + text + "\n";
    
    // Use WorkspaceEdit to modify the file without necessarily showing it
    // Wait, openTextDocument doesn't show it. But to edit we usually need an editor or WorkspaceEdit.
    const edit = new WorkspaceEdit();
    const endPos = doc.positionAt(existingText.length);
    edit.insert(pick.uri, endPos, appendText);
    
    const success = await hostEditor.applyWorkspaceEdit(edit);
    
    if (success) {
      // Save the document if it wasn't open, or just let it be dirty?
      // "Without opening the file for the user to edit" implies it should happen in background.
      // If we use WorkspaceEdit, it opens the file in dirty state if not open.
      // We should save it.
      await doc.save();
      hostEditor.showInformation(`Pasted into ${path.basename(pick.uri.fsPath)}`);
    } else {
      hostEditor.showErrorMessage(`Failed to fire into ${path.basename(pick.uri.fsPath)}`);
    }
  }
}

function deriveTitle(uri: Uri): string {
  const parsed = path.parse(uri.fsPath);
  const baseName = parsed.name.toLowerCase() === "index" ? path.basename(path.dirname(uri.fsPath)) : parsed.name;
  return baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
