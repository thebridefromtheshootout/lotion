import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as fs from "fs";
import * as path from "path";
import { relinkWorkspacePagePaths } from "./pageRelink";

export const MOVE_PAGE_SLASH_COMMAND: SlashCommand = {
  label: "/move-page",
  insertText: "",
  detail: "📦 Move current page folder",
  isAction: true,
  commandId: Cmd.movePage,
  kind: 2,
  handler: async () => movePage(),
};

export async function movePage(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    hostEditor.showWarning("Open a markdown page to move.");
    return;
  }

  const currentUri = hostEditor.getDocumentUri();
  if (!currentUri) {
    return;
  }

  const currentPath = currentUri.fsPath;
  if (path.basename(currentPath).toLowerCase() !== "index.md") {
    hostEditor.showWarning("Move page works on index.md page files.");
    return;
  }

  const currentDir = path.dirname(currentPath);
  const currentFolderName = path.basename(currentDir);
  const currentParentDir = path.dirname(currentDir);
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  const pageFiles = await hostEditor.findFiles("**/index.md", "**/node_modules/**");
  const destinations: { label: string; detail: string; absDir: string }[] = [
    { label: "/", detail: "Workspace root", absDir: workspaceRoot },
  ];

  for (const uri of pageFiles) {
    const dir = path.dirname(uri.fsPath);
    if (dir === currentDir || dir === currentParentDir) {
      continue;
    }
    // Avoid moving a folder into one of its descendants.
    const relativeToCurrent = path.relative(currentDir, dir);
    if (!relativeToCurrent.startsWith("..") && relativeToCurrent !== "") {
      continue;
    }
    const rel = path.relative(workspaceRoot, dir).replace(/\\/g, "/") || "/";
    destinations.push({
      label: rel,
      detail: dir,
      absDir: dir,
    });
  }

  destinations.sort((a, b) => a.label.localeCompare(b.label));

  const pick = await hostEditor.showQuickPick(destinations, {
    placeHolder: `Move "${currentFolderName}" to which parent folder?`,
    matchOnDescription: true,
    matchOnDetail: false,
  });
  if (!pick) {
    return;
  }

  const newDir = path.join(pick.absDir, currentFolderName);
  if (newDir === currentDir) {
    return;
  }
  if (fs.existsSync(newDir)) {
    hostEditor.showError(`Destination already has a page folder named '${currentFolderName}'.`);
    return;
  }

  const oldRelFromRoot = path.relative(workspaceRoot, currentDir).replace(/\\/g, "/");
  const newRelFromRoot = path.relative(workspaceRoot, newDir).replace(/\\/g, "/");

  await hostEditor.executeCommand("workbench.action.closeActiveEditor");
  fs.renameSync(currentDir, newDir);

  const updatedCount = await relinkWorkspacePagePaths(oldRelFromRoot, newRelFromRoot);

  const movedIndex = path.join(newDir, "index.md");
  if (fs.existsSync(movedIndex)) {
    const doc = await hostEditor.openTextDocument(movedIndex);
    await hostEditor.showTextDocument(doc);
  }

  hostEditor.showInformation(`Moved page to '${newRelFromRoot}'. Updated ${updatedCount} file(s).`);
}
