import { hostEditor } from "../hostEditor/HostingEditor";
import { Diagnostic, DiagnosticSeverity, Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { DiagnosticCollection, TextDocument } from "../hostEditor/EditorTypes";

/**
 * Document structure linter for markdown.
 *
 * Detects common structural issues:
 * - Skipped heading levels (e.g. # → ###)
 * - Multiple H1 headings
 * - Empty links [text]()
 * - Duplicate heading text (ambiguous anchors)
 * - Very long lines (>200 chars, excluding links/images)
 * - Unclosed code fences
 */

const COLLECTION_NAME = "lotion-structure";
let diagnosticCollection: DiagnosticCollection;

function lintDocument(doc: TextDocument): void {
  if (doc.languageId !== "markdown") {
    diagnosticCollection.delete(doc.uri);
    return;
  }

  const diagnostics: Diagnostic[] = [];
  let prevHeadingLevel = 0;
  let h1Count = 0;
  const headingTexts: Map<string, number> = new Map();
  let inCodeFence = false;
  let codeFenceStart = -1;

  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i);
    const text = line.text;

    // Code fence tracking
    if (/^```/.test(text)) {
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceStart = i;
      } else {
        inCodeFence = false;
        codeFenceStart = -1;
      }
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    // Heading analysis
    const headingMatch = text.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      // Multiple H1s
      if (level === 1) {
        h1Count++;
        if (h1Count > 1) {
          diagnostics.push(
            new Diagnostic(
              line.range,
              "Multiple H1 headings. Consider using a single H1 as the page title.",
              DiagnosticSeverity.Warning,
            ),
          );
        }
      }

      // Skipped heading levels
      if (prevHeadingLevel > 0 && level > prevHeadingLevel + 1) {
        diagnostics.push(
          new Diagnostic(
            line.range,
            `Heading level skipped: H${prevHeadingLevel} → H${level}. Consider using H${prevHeadingLevel + 1}.`,
            DiagnosticSeverity.Information,
          ),
        );
      }
      prevHeadingLevel = level;

      // Duplicate heading text
      const lowerText = headingText.toLowerCase();
      if (headingTexts.has(lowerText)) {
        diagnostics.push(
          new Diagnostic(
            line.range,
            `Duplicate heading "${headingText}" (also on line ${(headingTexts.get(lowerText) ?? 0) + 1}). Anchor links may be ambiguous.`,
            DiagnosticSeverity.Information,
          ),
        );
      } else {
        headingTexts.set(lowerText, i);
      }
    }

    // Empty links
    const emptyLinkRe = /\[([^\]]+)\]\(\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = emptyLinkRe.exec(text)) !== null) {
      const start = new Position(i, m.index);
      const end = new Position(i, m.index + m[0].length);
      diagnostics.push(
        new Diagnostic(new Range(start, end), `Empty link target for "${m[1]}".`, DiagnosticSeverity.Warning),
      );
    }

    // Long lines (skip lines with long URLs or images)
    if (text.length > 200 && !/!\[.*\]\(.*\)/.test(text) && !/\[.*\]\(https?:\/\/.*\)/.test(text)) {
      diagnostics.push(
        new Diagnostic(
          line.range,
          `Line is ${text.length} characters long. Consider wrapping for readability.`,
          DiagnosticSeverity.Hint,
        ),
      );
    }
  }

  // Unclosed code fence
  if (inCodeFence && codeFenceStart >= 0) {
    diagnostics.push(
      new Diagnostic(
        doc.lineAt(codeFenceStart).range,
        "Unclosed code fence (no matching ```).",
        DiagnosticSeverity.Warning,
      ),
    );
  }

  diagnosticCollection.set(doc.uri, diagnostics);
}

export function createStructureLinter(): Disposable {
  diagnosticCollection = hostEditor.createDiagnosticCollection(COLLECTION_NAME);

  const disposables = [
    diagnosticCollection,
    hostEditor.onDidOpenTextDocument(lintDocument),
    hostEditor.onDidSaveTextDocument(lintDocument),
    hostEditor.onDidChangeTextDocument((e) => lintDocument(e.document)),
    hostEditor.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    }),
  ];

  // Lint all open documents
  hostEditor.getTextDocuments().forEach(lintDocument);

  return Disposable.from(...disposables);
}
