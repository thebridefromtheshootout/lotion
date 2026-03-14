import { Position, Range, Selection, TextEditorRevealType, Uri } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Regex } from "../core/regex";

/**
 * Wiki-aware full-text search across all markdown pages.
 *
 * Results are grouped by page title with context preview,
 * unlike VS Code's built-in search which shows raw file paths.
 */

interface SearchResult {
  uri: Uri;
  pageTitle: string;
  line: number;
  lineText: string;
  relPath: string;
}

export async function wikiSearch(): Promise<void> {
  const query = await hostEditor.showInputBox({
    prompt: "Search all pages",
    placeHolder: "Enter search query (regex supported)",
  });

  if (!query) {
    return;
  }

  const files = await hostEditor.findFiles("**/*.md");
  const root = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath ?? "";

  let re: RegExp;
  try {
    re = new RegExp(query, "gi");
  } catch {
    re = new RegExp(query.replace(Regex.regexMetaCharsGlobal, "\\$&"), "gi");
  }

  const results: SearchResult[] = [];

  for (const uri of files) {
    try {
      const doc = await hostEditor.openTextDocument(uri);
      const text = doc.getText();

      if (!re.test(text)) {
        continue;
      }
      re.lastIndex = 0; // reset after test

      // Find page title (first # heading or filename)
      let pageTitle = path.basename(uri.fsPath, ".md");
      for (let i = 0; i < Math.min(doc.lineCount, 20); i++) {
        const h = doc.lineAt(i).text.match(Regex.headingH1Multiline);
        if (h) {
          pageTitle = h[1];
          break;
        }
      }

      const relPath = root ? path.relative(root, uri.fsPath).replace(Regex.windowsSlash, "/") : path.basename(uri.fsPath);

      // Collect matching lines
      for (let i = 0; i < doc.lineCount; i++) {
        const lineText = doc.lineAt(i).text;
        if (re.test(lineText)) {
          results.push({ uri, pageTitle, line: i, lineText: lineText.trim(), relPath });
        }
        re.lastIndex = 0;
      }
    } catch {
      // skip
    }
  }

  if (results.length === 0) {
    hostEditor.showInformation(`No results found for "${query}".`);
    return;
  }

  // Build quick pick items
  const items = results.map((r) => ({
    label: `$(file) ${r.pageTitle}`,
    description: `L${r.line + 1}`,
    detail: r.lineText.length > 120 ? r.lineText.substring(0, 120) + "…" : r.lineText,
    result: r,
  }));

  const picked = await hostEditor.showQuickPick(items, {
    placeHolder: `${results.length} match${results.length === 1 ? "" : "es"} for "${query}"`,
    matchOnDetail: true,
    matchOnDescription: true,
  });

  if (picked) {
    const doc = await hostEditor.openTextDocument(picked.result.uri);
    await hostEditor.showTextDocument(doc);
    const pos = new Position(picked.result.line, 0);
    hostEditor.setSelection(new Selection(pos, pos));
    hostEditor.revealRange(new Range(pos, pos), TextEditorRevealType.InCenter);
  }
}
