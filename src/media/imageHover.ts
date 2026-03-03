import { hostEditor } from "../hostEditor/HostingEditor";
import { Disposable, Hover, MarkdownString, Position, Range, Uri } from "../hostEditor/EditorTypes";
import type { HoverProvider, ProviderResult, TextDocument } from "../hostEditor/EditorTypes";
import * as path from "path";
import * as fs from "fs";

/**
 * Hover provider that shows image preview + dimensions when hovering
 * over markdown image syntax: ![alt](path)
 */

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export class ImageHoverProvider implements HoverProvider {
  provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
    const line = document.lineAt(position.line).text;
    IMAGE_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = IMAGE_RE.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (position.character < start || position.character > end) {
        continue;
      }

      const altText = match[1];
      const imgPath = match[2];

      // Resolve path
      let resolvedPath: string;
      if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
        // Remote image — just show the URL in a markdown image preview
        const md = new MarkdownString();
        md.appendMarkdown(`**Image:** ${altText || "(no alt text)"}\n\n`);
        md.appendMarkdown(`*URL:* ${imgPath}`);
        return new Hover(md, new Range(position.line, start, position.line, end));
      }

      // Local file
      const docDir = path.dirname(document.uri.fsPath);
      resolvedPath = path.resolve(docDir, imgPath);

      if (!fs.existsSync(resolvedPath)) {
        const md = new MarkdownString();
        md.appendMarkdown(`**Image not found:** \`${imgPath}\``);
        return new Hover(md, new Range(position.line, start, position.line, end));
      }

      const fileUri = Uri.file(resolvedPath);
      const stats = fs.statSync(resolvedPath);
      const sizeKB = (stats.size / 1024).toFixed(1);

      const md = new MarkdownString();
      md.supportHtml = true;
      md.isTrusted = true;
      // Render actual image thumbnail (max 360px wide)
      md.appendMarkdown(`![${altText}](${fileUri.toString()}|width=360)\n\n`);
      md.appendMarkdown(`**${altText || "(no alt text)"}** — ${sizeKB} KB`);

      return new Hover(md, new Range(position.line, start, position.line, end));
    }

    return null;
  }
}

export function createImageHoverProvider(): Disposable {
  return hostEditor.registerHoverProvider({ language: "markdown" }, new ImageHoverProvider());
}
