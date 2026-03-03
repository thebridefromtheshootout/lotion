import { Position, Uri } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const LINK_SLASH_COMMAND: SlashCommand = {
  label: "/link",
  insertText: "",
  detail: "🔗 Insert link to a page",
  isAction: true,
  commandId: Cmd.insertLink,
  kind: 17,
  handler: handleLinkCommand,
};

// ── /link quick insert ─────────────────────────────────────────────
//
// Presents a quick pick of all markdown pages in the workspace
// and inserts a relative markdown link to the chosen page.

export async function handleLinkCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const currentUri = document.uri;
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");

  // Build pick items excluding current file
  const items: { label: string; detail: string; uri: Uri }[] = [];

  for (const uri of mdFiles) {
    if (uri.fsPath === currentUri.fsPath) {
      continue;
    }

    const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath || "";
    const relPath = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, "/");

    items.push({
      label: deriveTitle(uri),
      detail: relPath,
      uri,
    });
  }

  items.sort((a, b) => a.label.localeCompare(b.label));

  if (items.length === 0) {
    hostEditor.showInformation("No other markdown pages found.");
    return;
  }

  const pick = await hostEditor.showQuickPick(items, {
    placeHolder: "Link to which page?",
    matchOnDetail: true,
  });

  if (!pick) {
    return;
  }

  // Compute relative path from current file to target
  const currentDir = path.dirname(currentUri.fsPath);
  let relLink = path.relative(currentDir, pick.uri.fsPath).replace(/\\/g, "/");

  // Build markdown link
  const linkText = `[${pick.label}](${relLink})`;

  await hostEditor.insertAt(position, linkText);
}

function deriveTitle(uri: Uri): string {
  const parsed = path.parse(uri.fsPath);
  const baseName = parsed.name.toLowerCase() === "index" ? path.basename(path.dirname(uri.fsPath)) : parsed.name;
  return baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
