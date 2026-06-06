import * as path from "path";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Diagnostic, DiagnosticSeverity, Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { DiagnosticCollection, TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";
import { findParentDbIndex, readDbEntries } from "./dbEntries";
import { parseSchemaFromFile, parseSchemaFromText } from "./dbSchema";
import { parsePropertyTable } from "./dbFrontmatter";
import { validateColumnValue, validateEntry } from "./dbValidate";

// ── Schema-violation diagnostics for DB index + entry files ───────
//
// Phase D of DATABASE_ROADMAP §1.5 + round-3 §1.5 follow-up (#7).
// Surfaces two flavours of validation issue in the Problems panel:
//
//   1. Entry files (`<slug>/index.md` under a DB folder): per-cell
//      and uniqueness violations of the entry's property table.
//   2. Index files (the file carrying the `lotion-db` schema fence):
//      schema-level config that contradicts itself, e.g. a `default:`
//      value that isn't in `options:` or fails its own validator.
//
// Each doc goes through one of the two paths; non-DB markdown is
// skipped entirely.

const COLLECTION_NAME = "lotion-db-validation";
let collection: DiagnosticCollection;

/** Returns the parent DB index path if `doc` is a DB entry file. */
function findParentDbIndexForEntry(doc: TextDocument): string | undefined {
  if (doc.languageId !== "markdown") {
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

/**
 * Lint a DB *index* file (the file carrying the `lotion-db` schema fence)
 * for schema-level config errors — currently just `default:` values that
 * don't pass their own column's validator (e.g. a select default not in
 * `options:`, a number default outside `min/max`).
 */
function lintIndex(doc: TextDocument): void {
  const text = doc.getText();
  const schema = parseSchemaFromText(text);
  if (!schema) {
    collection.delete(doc.uri);
    return;
  }

  const lines = text.split(Regex.lineBreakSplit);
  const diagnostics: Diagnostic[] = [];

  for (const col of schema.columns) {
    if (col.default === undefined || col.default === "") continue;
    const violation = validateColumnValue(col, col.default);
    if (!violation) continue;

    // Anchor the diagnostic on the schema's `default:` line for this
    // column (or the column's `- name:` header if we can't find it).
    const range =
      findSchemaLineRange(doc, lines, col.name, "default") ?? findSchemaLineRange(doc, lines, col.name, "name");
    diagnostics.push(
      new Diagnostic(
        range ?? new Range(new Position(0, 0), new Position(0, 0)),
        `Lotion: schema default for "${col.name}" — ${violation}`,
        DiagnosticSeverity.Warning,
      ),
    );
  }

  collection.set(doc.uri, diagnostics);
}

/**
 * Find the line range of `<key>:` belonging to the column block whose
 * `- name:` matches `columnName`. Returns undefined if the column or the
 * key isn't found in source.
 */
function findSchemaLineRange(
  doc: TextDocument,
  lines: string[],
  columnName: string,
  key: "name" | "default",
): Range | undefined {
  for (let i = 0; i < lines.length; i++) {
    const nameMatch = lines[i].match(Regex.dbDashNameLine);
    if (!nameMatch || nameMatch[1].trim() !== columnName) continue;

    if (key === "name") {
      return doc.lineAt(i).range;
    }

    // Walk forward until the next column or fence-end, looking for `default:`.
    for (let j = i + 1; j < lines.length; j++) {
      if (Regex.dbDashNameLine.test(lines[j]) || Regex.dbFenceEnd.test(lines[j])) break;
      if (Regex.dbColumnDefaultLine.test(lines[j])) {
        return doc.lineAt(j).range;
      }
    }
    return undefined;
  }
  return undefined;
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

/** Dispatch: index files go to lintIndex, child entries to lintEntry. */
function lintDocument(doc: TextDocument): void {
  if (doc.languageId !== "markdown") {
    collection.delete(doc.uri);
    return;
  }
  if (Regex.dbSchemaFenceStartMultiline.test(doc.getText())) {
    lintIndex(doc);
    return;
  }
  lintEntry(doc);
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
        lintDocument(doc);
      }, 200),
    );
  }

  const disposables = [
    collection,
    hostEditor.onDidOpenTextDocument(lintDocument),
    hostEditor.onDidSaveTextDocument(lintDocument),
    hostEditor.onDidChangeTextDocument((e) => lintDebounced(e.document)),
    hostEditor.onDidCloseTextDocument((doc) => {
      // Cancel any in-flight debounced lint so it doesn't re-`set` a
      // diagnostic collection entry on a doc the user just closed.
      const pending = pendingTimers.get(doc);
      if (pending) {
        clearTimeout(pending);
        pendingTimers.delete(doc);
      }
      collection.delete(doc.uri);
    }),
  ];

  hostEditor.getTextDocuments().forEach(lintDocument);

  return Disposable.from(...disposables);
}
