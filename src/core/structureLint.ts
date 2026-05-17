import { hostEditor } from "../hostEditor/HostingEditor";
import { Diagnostic, DiagnosticSeverity, Disposable } from "../hostEditor/EditorTypes";
import type { DiagnosticCollection, TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "./regex";
import { getBlockIndex } from "./blockIndex";

/**
 * Document structure linter for markdown.
 *
 * Only diagnoses skipped heading levels (e.g. `# → ###`) — that's a real
 * accessibility / outline-correctness issue. Other rules tried before
 * (multiple H1s, duplicate headings, empty links, long lines, unclosed
 * fences) were style preferences rather than correctness issues and
 * filled the Problems panel with noise.
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
  const idx = getBlockIndex(doc);

  for (let i = 0; i < doc.lineCount; i++) {
    if (idx.isInCodeFence(i)) continue;
    const line = doc.lineAt(i);
    const headingMatch = line.text.match(Regex.headingLineWithText);
    if (!headingMatch) continue;

    const level = headingMatch[1].length;
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
  }

  diagnosticCollection.set(doc.uri, diagnostics);
}

export function createStructureLinter(): Disposable {
  diagnosticCollection = hostEditor.createDiagnosticCollection(COLLECTION_NAME);

  // Coalesce per-keystroke change events. VS Code's own markdown linter
  // uses a similar 200ms cadence — we don't need diagnostics to update
  // while a user is mid-word.
  const pendingTimers = new WeakMap<TextDocument, ReturnType<typeof setTimeout>>();
  function lintDebounced(doc: TextDocument): void {
    const existing = pendingTimers.get(doc);
    if (existing) clearTimeout(existing);
    pendingTimers.set(
      doc,
      setTimeout(() => {
        pendingTimers.delete(doc);
        lintDocument(doc);
      }, 200),
    );
  }

  const disposables = [
    diagnosticCollection,
    hostEditor.onDidOpenTextDocument(lintDocument),
    // Save / open paths run synchronously so diagnostics are fresh when the
    // user explicitly checks the Problems panel.
    hostEditor.onDidSaveTextDocument(lintDocument),
    hostEditor.onDidChangeTextDocument((e) => lintDebounced(e.document)),
    hostEditor.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    }),
  ];

  // Lint all open documents
  hostEditor.getTextDocuments().forEach(lintDocument);

  return Disposable.from(...disposables);
}
