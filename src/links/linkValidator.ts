import { hostEditor } from "../hostEditor/HostingEditor";
import { Diagnostic, DiagnosticSeverity, Disposable, Range } from "../hostEditor/EditorTypes";
import type { DiagnosticCollection, TextDocument } from "../hostEditor/EditorTypes";
import * as path from "path";
import * as fs from "fs";
import { Regex } from "../core/regex";

// ── Link validator ─────────────────────────────────────────────────
//
// Scans all markdown files for internal links and reports any that
// point to non-existent files. Uses VS Code diagnostics so broken
// links appear as warnings in the Problems panel.

const LINK_RE = Regex.markdownLinkGlobal;

let diagnosticCollection: DiagnosticCollection | undefined;

export function createLinkValidator(): Disposable {
  diagnosticCollection = hostEditor.createDiagnosticCollection("lotion-links");

  // Validate on activation
  validateAllLinks();

  const disposables: Disposable[] = [
    diagnosticCollection,
    hostEditor.onDidSaveTextDocument((doc) => {
      if (doc.languageId === "markdown") {
        validateDocument(doc);
      }
    }),
    hostEditor.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "markdown") {
        validateDocument(doc);
      }
    }),
    hostEditor.onDidDeleteFiles(() => validateAllLinks()),
    hostEditor.onDidRenameFiles(() => validateAllLinks()),
  ];

  return Disposable.from(...disposables);
}

async function validateAllLinks(): Promise<void> {
  if (!diagnosticCollection) {
    return;
  }
  diagnosticCollection.clear();

  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  for (const uri of mdFiles) {
    try {
      const doc = await hostEditor.openTextDocument(uri);
      validateDocument(doc);
    } catch {
      // skip
    }
  }
}

function validateDocument(document: TextDocument): void {
  if (!diagnosticCollection) {
    return;
  }

  const diagnostics: Diagnostic[] = [];
  const text = document.getText();
  const fileDir = path.dirname(document.uri.fsPath);

  let match: RegExpExecArray | null;
  // Reset regex state
  LINK_RE.lastIndex = 0;

  while ((match = LINK_RE.exec(text)) !== null) {
    const target = match[2].split("#")[0].split("?")[0].trim();

    // Skip external links, data URIs, and empty targets
    if (
      !target ||
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("data:") ||
      target.startsWith("#")
    ) {
      continue;
    }

    const absTarget = path.resolve(fileDir, target);

    if (!fs.existsSync(absTarget)) {
      const startOffset = match.index + match[0].indexOf(match[2]);
      const startPos = document.positionAt(startOffset);
      const endPos = document.positionAt(startOffset + match[2].length);

      diagnostics.push(
        new Diagnostic(new Range(startPos, endPos), `Broken link: '${target}' not found`, DiagnosticSeverity.Warning),
      );
    }
  }

  diagnosticCollection.set(document.uri, diagnostics);
}
