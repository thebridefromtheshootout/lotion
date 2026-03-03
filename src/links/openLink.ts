
import { Position, Uri } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const OPENLINK_SLASH_COMMAND: SlashCommand = {
  label: "/openlink",
  insertText: "",
  detail: "📂 Open the nearest page link",
  isAction: true,
  commandId: Cmd.openLink,
  kind: 17,
  handler: handleOpenLinkCommand,
};

// ── /openlink — Open the closest page link to cursor ───────────────
//
// Finds the nearest markdown link on the current line (or adjacent lines)
// and opens the target file.

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

interface LinkMatch {
  text: string;
  target: string;
  line: number;
  start: number;
  end: number;
  distance: number;
}

/**
 * /openlink — Find the closest markdown link to the cursor and open it.
 */
export async function handleOpenLinkCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  // Search current line and up to 3 lines above/below
  const searchRadius = 3;
  const startLine = Math.max(0, position.line - searchRadius);
  const endLine = Math.min(document.lineCount - 1, position.line + searchRadius);

  const links: LinkMatch[] = [];

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineText = document.lineAt(lineNum).text;
    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = LINK_RE.exec(lineText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Skip image links (preceded by `!`)
      if (start > 0 && lineText[start - 1] === "!") {
        continue;
      }

      const target = match[2];
      // Skip external URLs and anchor-only links
      if (/^https?:\/\/|^mailto:|^#/.test(target)) {
        continue;
      }

      // Calculate distance from cursor
      let distance: number;
      if (lineNum === position.line) {
        // Same line: measure horizontal distance
        if (position.character >= start && position.character <= end) {
          distance = 0; // cursor is inside the link
        } else if (position.character < start) {
          distance = start - position.character;
        } else {
          distance = position.character - end;
        }
      } else {
        // Different line: vertical distance (in "units" of ~80 chars)
        distance = Math.abs(lineNum - position.line) * 80;
      }

      links.push({
        text: match[1],
        target,
        line: lineNum,
        start,
        end,
        distance,
      });
    }
  }

  if (links.length === 0) {
    hostEditor.showInformation("No page links found near cursor.");
    return;
  }

  // Sort by distance and pick the closest
  links.sort((a, b) => a.distance - b.distance);
  const closest = links[0];

  // Resolve the link target
  const targetPath = resolveLink(document, closest.target);
  if (!targetPath) {
    hostEditor.showWarning(`Cannot resolve link: ${closest.target}`);
    return;
  }

  if (!fs.existsSync(targetPath)) {
    hostEditor.showWarning(`File not found: ${closest.target}`);
    return;
  }

  // Open the target file
  const targetUri = Uri.file(targetPath);
  await hostEditor.executeCommand("vscode.open", targetUri);
}

function resolveLink(doc: TextDocument, target: string): string | undefined {
  // Strip fragment (anchor)
  const clean = target.split("#")[0];
  if (!clean) {
    return undefined;
  }

  const dir = path.dirname(doc.uri.fsPath);
  const resolved = path.resolve(dir, clean);

  // If it's a directory, look for index.md
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const indexPath = path.join(resolved, "index.md");
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
    return undefined;
  }

  return resolved;
}
