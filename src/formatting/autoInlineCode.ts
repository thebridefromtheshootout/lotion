import { Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { getBlockIndex } from "../core/blockIndex";

const TRIGGER_CHARS = new Set([" ", ",", ".", ";", ":", "!", "?", ")", "]", "}"]);
const WORD_BEFORE = /(\w+)$/;
const PASCAL_CASE = /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/;
const CAMEL_CASE = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/;
const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)+$/;

interface CaseSettings {
  PascalCase?: boolean;
  camelCase?: boolean;
  snake_case?: boolean;
}

function isInsideCode(doc: TextDocument, pos: Position): boolean {
  if (getBlockIndex(doc).isInCodeFence(pos.line)) {
    return true;
  }
  const before = doc.lineAt(pos.line).text.substring(0, pos.character);
  const backticks = (before.match(Regex.backtick) || []).length;
  return backticks % 2 === 1;
}

function matchesEnabledCase(word: string, cases: CaseSettings): boolean {
  if (cases.PascalCase && PASCAL_CASE.test(word)) return true;
  if (cases.camelCase && CAMEL_CASE.test(word)) return true;
  if (cases.snake_case && SNAKE_CASE.test(word)) return true;
  return false;
}

export function createAutoInlineCode(): Disposable {
  return hostEditor.onDidChangeTextDocument((e) => {
    if (e.document.languageId !== "markdown") return;
    if (!hostEditor.isActiveEditorDocumentEqualTo(e.document)) return;

    const cases = hostEditor
      .getConfiguration("lotion")
      .get<CaseSettings>("autoInlineCodeCases", { PascalCase: false, camelCase: false, snake_case: false });

    if (!cases.PascalCase && !cases.camelCase && !cases.snake_case) return;

    const doc = e.document;

    for (const change of e.contentChanges) {
      if (change.text.length !== 1 || !TRIGGER_CHARS.has(change.text)) continue;

      const pos = change.range.start;
      if (isInsideCode(doc, pos)) continue;

      const before = doc.lineAt(pos.line).text.substring(0, pos.character);
      const m = before.match(WORD_BEFORE);
      if (!m) continue;

      const word = m[1];
      if (!matchesEnabledCase(word, cases)) continue;

      const wordStart = pos.character - word.length;
      const replaceRange = new Range(new Position(pos.line, wordStart), new Position(pos.line, pos.character));

      setTimeout(() => {
        hostEditor.replaceRange(replaceRange, `\`${word}\``, { undoStopBefore: false, undoStopAfter: false });
      }, 0);
    }
  });
}
