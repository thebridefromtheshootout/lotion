import { Disposable, Position, Range, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";

/**
 * Snippet / abbreviation expander.
 *
 * Reads abbreviation definitions from frontmatter  or from a workspace-level
 * `.lotion-snippets.json` and expands them when the user types an abbreviation
 * and presses Tab.
 *
 * `.lotion-snippets.json` format:
 * ```json
 * {
 *   "dt": "$(date)",
 *   "sig": "— John Doe",
 *   "cb": "```\n$1\n```"
 * }
 * ```
 *
 * Special variables:
 * - $(date) → today's date (YYYY-MM-DD)
 * - $(time) → current time (HH:MM)
 * - $(file) → current filename without extension
 * - $(clipboard) → clipboard contents
 * - $1, $2 → VS Code snippet tab stops
 */

import * as fs from "fs";
import * as path from "path";

interface SnippetMap {
  [abbrev: string]: string;
}

export function createSnippetExpander(): Disposable {
  return hostEditor.registerCommand(Cmd.expandSnippet, async () => {
    if (!hostEditor.isMarkdownEditor()) {
      return;
    }
    const doc = hostEditor.getDocument()!;
    const pos = hostEditor.getCursorPosition()!;
    const lineText = doc.lineAt(pos.line).text;

    // Find the word before the cursor
    const beforeCursor = lineText.substring(0, pos.character);
    const wordMatch = beforeCursor.match(Regex.trailingNonWhitespaceWord);
    if (!wordMatch) {
      return;
    }

    const abbrev = wordMatch[1];
    const snippets = loadSnippets(doc);

    if (!snippets[abbrev]) {
      // No snippet matched — let Tab do its default thing
      await hostEditor.executeCommand("tab");
      return;
    }

    const body = expandVariables(snippets[abbrev], doc);
    const wordStart = new Position(pos.line, pos.character - abbrev.length);
    const wordRange = new Range(wordStart, pos);

    // If the body contains $1/$2 tab stops, insert as snippet
    if (Regex.snippetTabstop.test(body)) {
      await hostEditor.insertSnippet(new SnippetString(body), wordRange);
    } else {
      await hostEditor.replaceRange(wordRange, body);
    }
  });
}

function loadSnippets(doc: TextDocument): SnippetMap {
  const snippets: SnippetMap = {};

  // 1. Workspace-level file
  const folders = hostEditor.getWorkspaceFolders();
  if (folders) {
    for (const folder of folders) {
      const file = path.join(folder.uri.fsPath, ".lotion-snippets.json");
      if (fs.existsSync(file)) {
        try {
          const data = JSON.parse(fs.readFileSync(file, "utf-8"));
          Object.assign(snippets, data);
        } catch {
          /* ignore bad json */
        }
      }
    }
  }

  // 2. Frontmatter "snippets:" block
  const text = doc.getText();
  const fm = text.match(Regex.frontmatterBlock);
  if (fm) {
    const snipSection = fm[1].match(Regex.snippetsSection);
    if (snipSection) {
      const lines = snipSection[1].split(Regex.lineBreakSplit).filter(Boolean);
      for (const line of lines) {
        const kv = line.match(Regex.snippetLineKeyValue);
        if (kv) {
          snippets[kv[1]] = kv[2].replace(Regex.quotedStringEdges, "");
        }
      }
    }
  }

  return snippets;
}

function expandVariables(body: string, doc: TextDocument): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  let result = body;
  result = result.replace(Regex.snippetVarDate, `${yyyy}-${mm}-${dd}`);
  result = result.replace(Regex.snippetVarTime, `${hh}:${min}`);
  result = result.replace(Regex.snippetVarFile, path.basename(doc.uri.fsPath, path.extname(doc.uri.fsPath)));

  // Clipboard will be handled at expansion time
  // but since we can't await inside replace, do it here
  // (clipboard read is async, so we handle it in the command itself if needed)
  return result;
}
