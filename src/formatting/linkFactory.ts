import { Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { cursorInCodeContext } from "../editor/codeContext";
import { buildAnchorTag } from "../editor/smartPaste";

const TRIGGER_CHARS = new Set([" ", ",", ".", ";", ":", "!", "?", ")", "]", "}"]);

interface LinkFactoryRule {
  match: string;
  prefix: string;
  suffix?: string;
}

interface CompiledRule {
  pattern: RegExp;
  prefix: string;
  suffix: string;
}

function compileRules(rules: LinkFactoryRule[]): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const rule of rules) {
    try {
      // Anchor the pattern to match the full word — wrap in a capturing group
      out.push({
        pattern: new RegExp(`(${rule.match})$`),
        prefix: rule.prefix,
        suffix: rule.suffix ?? "",
      });
    } catch {
      // Skip invalid regex
    }
  }
  return out;
}

function isInsideHtmlTag(lineText: string, charPos: number): boolean {
  // Check if position is inside an HTML tag by looking for unclosed < before position
  const before = lineText.slice(0, charPos);
  const lastOpen = before.lastIndexOf("<");
  const lastClose = before.lastIndexOf(">");
  return lastOpen > lastClose;
}

export function createLinkFactory(): Disposable {
  let processing = false;

  return hostEditor.onDidChangeTextDocument((e) => {
    if (processing) return;
    if (e.document.languageId !== "markdown") return;
    if (!hostEditor.isActiveEditorDocumentEqualTo(e.document)) return;

    const rules = hostEditor
      .getConfiguration("lotion")
      .get<LinkFactoryRule[]>("linkFactoryRules", []);
    if (rules.length === 0) return;

    const compiled = compileRules(rules);
    if (compiled.length === 0) return;

    const doc = e.document;

    for (const change of e.contentChanges) {
      if (change.text.length !== 1 || !TRIGGER_CHARS.has(change.text)) continue;

      const pos = change.range.start;
      if (cursorInCodeContext(doc, pos)) continue;

      const lineText = doc.lineAt(pos.line).text;
      const before = lineText.substring(0, pos.character);

      if (isInsideHtmlTag(lineText, pos.character)) continue;

      for (const rule of compiled) {
        const m = before.match(rule.pattern);
        if (!m) continue;

        const matched = m[1];
        const matchStart = pos.character - matched.length;

        // Don't transform if already inside a tag
        const precedingText = lineText.substring(0, matchStart);
        if (/<[^>]*$/.test(precedingText)) continue;

        const url = `${rule.prefix}${matched}${rule.suffix}`;
        const replaceRange = new Range(
          new Position(pos.line, matchStart),
          new Position(pos.line, pos.character),
        );

        processing = true;

        void (async () => {
          try {
            const tag = await buildAnchorTag(url);
            await hostEditor.replaceRange(replaceRange, tag, { undoStopBefore: true, undoStopAfter: true });
          } finally {
            processing = false;
          }
        })();

        break; // Only apply first matching rule
      }
    }
  });
}
