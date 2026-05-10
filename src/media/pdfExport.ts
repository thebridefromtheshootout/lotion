import { Uri } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import { escHtml } from "../core/html";
import type { SlashCommand } from "../core/slashCommands";
import { markdownToHtml } from "./pdfExportMarkdownToHtml";
import { buildExportHtml } from "./pdfExportTemplate";

// ── Re-exports ─────────────────────────────────────────────────────

export { escHtml };
export { markdownToHtml };

// ── Slash command ──────────────────────────────────────────────────

export const EXPORT_SLASH_COMMAND: SlashCommand = {
  label: "/export",
  insertText: "",
  detail: "📄 Export page to PDF / HTML",
  isAction: true,
  commandId: Cmd.exportToPdf,
  kind: 2,
  handler: exportToPdf,
};

// ── /export handler ────────────────────────────────────────────────
//
// Renders the current Markdown document to a self-contained, beautifully
// styled HTML file suitable for printing to PDF (Ctrl+P in any browser).
// Offers two export paths:
//   1. Open in browser → user prints to PDF
//   2. Save as HTML file

/** Export the currently active markdown document to HTML/PDF. */
export async function exportToPdf(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    hostEditor.showWarning("Lotion: open a Markdown file first.");
    return;
  }
  const doc = hostEditor.getDocument()!;
  const mdText = hostEditor.getDocumentText();
  const fileName = path.basename(doc.fileName, path.extname(doc.fileName));
  const fileDir = path.dirname(doc.uri.fsPath);

  // Extract title from first heading or filename
  const titleMatch = mdText.match(Regex.headingH1Multiline);
  const title = titleMatch ? titleMatch[1] : fileName;

  // Convert relative image paths to absolute file:// URIs for local rendering
  let htmlBody = markdownToHtml(mdText);
  htmlBody = htmlBody.replace(Regex.htmlRelativeSrcAttrGlobal, (_match, relPath: string) => {
    const absPath = path.resolve(fileDir, relPath);
    return `src="file:///${absPath.replace(Regex.windowsSlash, "/")}"`;
  });

  const fullHtml = buildExportHtml(title, htmlBody);

  // Ask user what they want to do
  const action = await hostEditor.showQuickPick(
    [
      { label: "$(browser) Open in Browser", description: "View in browser → Print to PDF (Ctrl+P)", value: "browser" },
      { label: "$(file-code) Save as HTML", description: "Save a self-contained HTML file", value: "html" },
    ],
    { placeHolder: "How would you like to export?" },
  );

  if (!action) {
    return;
  }

  if (action.value === "html") {
    const saveUri = await hostEditor.showSaveDialog({
      defaultUri: Uri.file(path.join(fileDir, `${fileName}.html`)),
      filters: { "HTML Files": ["html"] },
    });
    if (!saveUri) {
      return;
    }
    fs.writeFileSync(saveUri.fsPath, fullHtml, "utf-8");
    const openIt = await hostEditor.showInformationMessage(`Exported to ${path.basename(saveUri.fsPath)}`, [
      "Open in Browser",
      "Open in Editor",
    ]);
    if (openIt === "Open in Browser") {
      hostEditor.openExternal(saveUri);
    } else if (openIt === "Open in Editor") {
      const d = await hostEditor.openTextDocument(saveUri);
      await hostEditor.showTextDocument(d);
    }
  } else {
    // Write to temp file and open in browser
    const tmpDir = path.join(fileDir, ".lotion-export");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpFile = path.join(tmpDir, `${fileName}.html`);
    fs.writeFileSync(tmpFile, fullHtml, "utf-8");
    await hostEditor.openExternal(Uri.file(tmpFile));
    hostEditor.showInformation(`Opened "${title}" in your browser. Press Ctrl+P / ⌘P to print as PDF.`);
  }
}
