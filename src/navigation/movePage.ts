import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";
import { Position, Range, WorkspaceEdit } from "../hostEditor/EditorTypes";
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

function splitTarget(target: string): { pathPart: string; suffix: string } {
  const idx = target.search(Regex.queryOrHashMarker);
  if (idx === -1) {
    return { pathPart: target, suffix: "" };
  }
  return {
    pathPart: target.slice(0, idx),
    suffix: target.slice(idx),
  };
}

function isExternalTarget(target: string): boolean {
  return (
    Regex.httpOrMailtoOrAnchor.test(target) ||
    target.startsWith("data:") ||
    target.startsWith("file:") ||
    target.startsWith("//")
  );
}

function pathEqual(a: string, b: string): boolean {
  if (process.platform === "win32") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function fallbackTitleFromFolder(folderName: string): string {
  return folderName.replace(Regex.dashUnderscore, " ").replace(Regex.wordBoundaryChar, (c) => c.toUpperCase());
}

function extractTitleFromPage(content: string, folderName: string): string {
  const h1 = content.match(Regex.headingH1Multiline);
  if (h1 && h1[1].trim()) {
    return h1[1].trim();
  }
  return fallbackTitleFromFolder(folderName);
}

function hasLinkToPage(parentText: string, parentDir: string, workspaceRoot: string, movedIndexPath: string): boolean {
  const linkRe = new RegExp(Regex.markdownLinkGlobal.source, "g");
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(parentText)) !== null) {
    // Skip image links
    if (match.index > 0 && parentText[match.index - 1] === "!") {
      continue;
    }
    const { pathPart } = splitTarget(match[2]);
    if (!pathPart || isExternalTarget(pathPart)) {
      continue;
    }
    const resolved = pathPart.startsWith("/")
      ? path.resolve(workspaceRoot, "." + pathPart)
      : path.resolve(parentDir, pathPart);
    if (pathEqual(resolved, movedIndexPath)) {
      return true;
    }
  }

  const refDefRe = new RegExp(Regex.refLinkDefinitionGlobalMultiline.source, "gm");
  while ((match = refDefRe.exec(parentText)) !== null) {
    const { pathPart } = splitTarget(match[2]);
    if (!pathPart || isExternalTarget(pathPart)) {
      continue;
    }
    const resolved = pathPart.startsWith("/")
      ? path.resolve(workspaceRoot, "." + pathPart)
      : path.resolve(parentDir, pathPart);
    if (pathEqual(resolved, movedIndexPath)) {
      return true;
    }
  }

  return false;
}

async function addLinkToParentPage(
  parentDir: string,
  movedIndexPath: string,
  workspaceRoot: string,
  title: string,
): Promise<boolean> {
  const parentIndexPath = path.join(parentDir, "index.md");
  if (!fs.existsSync(parentIndexPath)) {
    return false;
  }

  const parentDoc = await hostEditor.openTextDocument(parentIndexPath);
  const parentText = parentDoc.getText();
  if (hasLinkToPage(parentText, parentDir, workspaceRoot, movedIndexPath)) {
    return false;
  }

  const relLink = path.relative(parentDir, movedIndexPath).replace(Regex.windowsSlash, "/");
  const linkLine = `- [${title}](${relLink})`;
  const separator = parentText.length === 0 ? "" : parentText.endsWith("\n") ? "" : "\n";
  const newText = `${parentText}${separator}${linkLine}\n`;

  const edit = new WorkspaceEdit();
  const fullRange = new Range(
    new Position(0, 0),
    new Position(parentDoc.lineCount - 1, parentDoc.lineAt(parentDoc.lineCount - 1).text.length),
  );
  edit.replace(parentDoc.uri, fullRange, newText);
  await hostEditor.applyWorkspaceEdit(edit);
  await parentDoc.save();
  return true;
}

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
    const rel = path.relative(workspaceRoot, dir).replace(Regex.windowsSlash, "/") || "/";
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

  const oldRelFromRoot = path.relative(workspaceRoot, currentDir).replace(Regex.windowsSlash, "/");
  const newRelFromRoot = path.relative(workspaceRoot, newDir).replace(Regex.windowsSlash, "/");

  await hostEditor.executeCommand("workbench.action.closeActiveEditor");
  fs.renameSync(currentDir, newDir);

  const updatedCount = await relinkWorkspacePagePaths(oldRelFromRoot, newRelFromRoot);

  const movedIndex = path.join(newDir, "index.md");
  let pageTitle = fallbackTitleFromFolder(currentFolderName);
  if (fs.existsSync(movedIndex)) {
    const doc = await hostEditor.openTextDocument(movedIndex);
    pageTitle = extractTitleFromPage(doc.getText(), currentFolderName);
    await hostEditor.showTextDocument(doc);
  }

  const parentLinkAdded = await addLinkToParentPage(pick.absDir, movedIndex, workspaceRoot, pageTitle);

  const parentMsg = parentLinkAdded ? " Added link in parent page." : "";
  hostEditor.showInformation(`Moved page to '${newRelFromRoot}'. Updated ${updatedCount} file(s).${parentMsg}`);
}
