import * as path from "path";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Diagnostic, DiagnosticSeverity, Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { DiagnosticCollection, TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";
import { findParentDbIndex, readDbEntries } from "./dbEntries";
import { parseSchemaFromFile } from "./dbSchema";
import { parsePropertyTable } from "./dbFrontmatter";
import { validateEntry } from "./dbValidate";

// ── Schema-violation diagnostics for DB entry files ────────────────
//
// Phase D of DATABASE_ROADMAP §1.5. Surfaces validation violations
// (required/type/range/options/uniqueness) as workspace diagnostics so
// the Problems panel shows them at a glance — no need to wait for the
// user to open the webview and click the cell.
//
// The collection only targets DB *entry* files (a `<slug>/index.md`
// child of a DB folder). Index files and non-DB markdown are skipped.

const COLLECTION_NAME = "lotion-db-validation";
let collection: DiagnosticCollection;

/** Returns the parent DB index path if `doc` is a DB entry file. */
function findParentDbIndexForEntry(doc: TextDocument): string | undefined {
  if (doc.languageId !== "markdown") {
    return undefined;
  }
  // The DB index itself has a schema fence — skip it (no property table to validate).
  if (Regex.dbSchemaFenceStartMultiline.test(doc.getText())) {
    return undefined;
  }
  return findParentDbIndex(doc.uri.fsPath);
}

/**
 * Walk `text` line-by-line and return the line index where each property
 * row starts. Used to anchor diagnostics on the offending row instead of
 * the whole file.
 */
function findPropertyRowLines(
  text: string,
): { rows: Map<string, number>; tableStart: number; tableEnd: number } | undefined {
  const lines = text.split(Regex.lineBreakSplit);

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (Regex.propertyTableHeader.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return undefined;
  if (headerIdx + 1 >= lines.length || !Regex.propertyTableSeparator.test(lines[headerIdx + 1])) {
    return undefined;
  }

  const rows = new Map<string, number>();
  let endIdx = headerIdx + 1;
  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!lines[i].startsWith("|")) break;
    const cells = lines[i]
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length >= 1 && cells[0]) {
      rows.set(cells[0], i);
    }
    endIdx = i;
  }
  return { rows, tableStart: headerIdx, tableEnd: endIdx };
}

function lintEntry(doc: TextDocument): void {
  const dbIndexPath = findParentDbIndexForEntry(doc);
  if (!dbIndexPath) {
    collection.delete(doc.uri);
    return;
  }

  const schema = parseSchemaFromFile(dbIndexPath);
  if (!schema) {
    collection.delete(doc.uri);
    return;
  }

  const text = doc.getText();
  const props = parsePropertyTable(text);
  if (!props) {
    collection.delete(doc.uri);
    return;
  }

  const dbDir = path.dirname(dbIndexPath);
  const otherEntries = readDbEntries(dbDir)
    .filter((e) => path.resolve(dbDir, e.relativePath) !== doc.uri.fsPath)
    .map((e) => e.properties);

  const violations = validateEntry(schema, props, otherEntries);
  if (violations.length === 0) {
    collection.delete(doc.uri);
    return;
  }

  const rowLines = findPropertyRowLines(text);
  const diagnostics: Diagnostic[] = violations.map((v) => {
    const line = rowLines?.rows.get(v.col);
    let range: Range;
    if (line !== undefined && line < doc.lineCount) {
      range = doc.lineAt(line).range;
    } else if (rowLines) {
      range = new Range(new Position(rowLines.tableStart, 0), new Position(rowLines.tableEnd, 0));
    } else {
      range = new Range(new Position(0, 0), new Position(0, 0));
    }
    return new Diagnostic(range, `Lotion: ${v.message}`, DiagnosticSeverity.Warning);
  });

  collection.set(doc.uri, diagnostics);
}

export function createDbEntryLinter(): Disposable {
  collection = hostEditor.createDiagnosticCollection(COLLECTION_NAME);

  // Same 200ms debounce as structureLint — diagnostics don't need to flash
  // on every keystroke while the user is mid-edit.
  const pendingTimers = new WeakMap<TextDocument, ReturnType<typeof setTimeout>>();
  function lintDebounced(doc: TextDocument): void {
    const existing = pendingTimers.get(doc);
    if (existing) clearTimeout(existing);
    pendingTimers.set(
      doc,
      setTimeout(() => {
        pendingTimers.delete(doc);
        lintEntry(doc);
      }, 200),
    );
  }

  const disposables = [
    collection,
    hostEditor.onDidOpenTextDocument(lintEntry),
    hostEditor.onDidSaveTextDocument(lintEntry),
    hostEditor.onDidChangeTextDocument((e) => lintDebounced(e.document)),
    hostEditor.onDidCloseTextDocument((doc) => {
      collection.delete(doc.uri);
    }),
  ];

  hostEditor.getTextDocuments().forEach(lintEntry);

  return Disposable.from(...disposables);
}
