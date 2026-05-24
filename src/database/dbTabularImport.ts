import * as path from "path";
import * as fs from "fs";
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { getCwd } from "../core/cwd";
import { DbColumn, DbSchema, serializeSchema } from "./dbSchema";
import { buildPropertyTable } from "./dbFrontmatter";
import { Markers } from "../core/markers";
import { Regex } from "../core/regex";
import { toPathSlug } from "../core/slug";
import { parseCsvText } from "../core/csv";
import { parseTable } from "../editor/table";
import { promptColumnDefinition } from "./dbColumnPrompt";
import { parseJsonToTabular, JsonImportError } from "./dbJsonImport";

// ── Table / CSV import to DB ──────────────────────────────────────

interface ParsedTabularData {
  headers: string[];
  rows: string[][];
  startLine?: number;
  endLine?: number;
}

function normalizeTabularHeaders(rawHeaders: string[]): string[] {
  const used = new Set<string>();
  return rawHeaders.map((raw, idx) => {
    const base = raw.trim() || `Column ${idx + 1}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base} ${n}`;
      n++;
    }
    used.add(candidate);
    return candidate;
  });
}

function normalizeRowWidth(row: string[], width: number): string[] {
  if (row.length === width) {
    return row;
  }
  if (row.length > width) {
    return row.slice(0, width);
  }
  return [...row, ...Array.from({ length: width - row.length }, () => "")];
}

function parseMarkdownTableAtCursor(document: TextDocument, position: Position): ParsedTabularData | undefined {
  const isTableRow = (line: number) => Regex.markdownTableRow.test(document.lineAt(line).text);

  if (!isTableRow(position.line)) {
    return undefined;
  }

  let start = position.line;
  let end = position.line;

  while (start > 0 && isTableRow(start - 1)) {
    start--;
  }
  while (end + 1 < document.lineCount && isTableRow(end + 1)) {
    end++;
  }

  if (end - start < 2 || !Regex.markdownTableSeparatorRow.test(document.lineAt(start + 1).text)) {
    return undefined;
  }

  // Reuse the canonical parser from editor/table.ts. It returns { headers, rows }
  // with cells trimmed; we then de-duplicate header names and pad each row to
  // the header width so the database import gets a rectangular grid.
  const parsed = parseTable(document, { start, end });
  if (!parsed) return undefined;

  const headers = normalizeTabularHeaders(parsed.headers);
  if (headers.length === 0) {
    return undefined;
  }
  const rows = parsed.rows.map((row) => normalizeRowWidth(row, headers.length));
  return { headers, rows, startLine: start, endLine: end };
}

function makeUniqueEntryDir(dbDir: string, desiredSlug: string): string {
  let candidate = desiredSlug || "entry";
  let n = 2;
  while (fs.existsSync(path.join(dbDir, candidate, "index.md"))) {
    candidate = `${desiredSlug || "entry"}-${n}`;
    n++;
  }
  return candidate;
}

async function createDatabaseFromTabularData(
  document: TextDocument,
  position: Position,
  data: ParsedTabularData,
  sourceLabel: "table" | "csv" | "json",
  opts?: { deleteSourceTable?: boolean },
): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  if (data.headers.length === 0) {
    hostEditor.showWarning("No headers found to build database columns.");
    return;
  }

  const dbName = await hostEditor.showInputBox({
    prompt: `Database name (${sourceLabel} import)`,
    placeHolder: "Imported Database",
    validateInput: (v) => (!v || v.trim().length === 0 ? "Name cannot be empty" : undefined),
  });
  if (!dbName) {
    return;
  }

  const titleColPick = await hostEditor.showQuickPick(
    data.headers.map((h, i) => ({ label: h, description: i === 0 ? "Recommended" : undefined })),
    { placeHolder: "Which header should be used as entry title?" },
  );
  if (!titleColPick) {
    return;
  }

  const titleColIndex = data.headers.findIndex((h) => h === titleColPick.label);
  if (titleColIndex < 0) {
    return;
  }
  // tODO this whole flow to get a schema object should be reused across db creationflows.
  const columns: DbColumn[] = [];
  for (let i = 0; i < data.headers.length; i++) {
    const header = data.headers[i];

    // The chosen title/name field is always free text.
    if (i === titleColIndex) {
      columns.push({ name: header, type: "text" });
      continue;
    }

    const col = await promptColumnDefinition(header);
    if (!col) {
      return;
    }
    columns.push(col);
  }

  const schema: DbSchema = { titleField: data.headers[titleColIndex], columns };
  // TODO this whole flow is just creating a lotion page. all such flows should use a single centralized create child page method
  const dbSlug = toPathSlug(dbName);
  const dbDir = path.join(cwd, dbSlug);
  const dbFilePath = path.join(dbDir, "index.md");
  const dbRelPath = `${dbSlug}/index.md`;

  if (fs.existsSync(dbDir)) {
    hostEditor.showError(`Database folder "${dbSlug}" already exists.`);
    return;
  }

  fs.mkdirSync(dbDir, { recursive: true });

  const schemaYaml = serializeSchema(schema);
  fs.writeFileSync(
    dbFilePath,
    `# ${dbName}\n\n\`\`\`${Markers.dbFenceLang}\n${schemaYaml}\n\`\`\`\n\n---\n\n`,
    "utf-8",
  );

  const entryLinks: string[] = [];
  let created = 0;
  for (const row of data.rows) {
    const normalized = normalizeRowWidth(row, data.headers.length);
    if (normalized.every((c) => c.trim().length === 0)) {
      continue;
    }

    const entryTitle = normalized[titleColIndex]?.trim() || `Entry ${created + 1}`;
    const entrySlug = makeUniqueEntryDir(dbDir, toPathSlug(entryTitle));
    const entryDir = path.join(dbDir, entrySlug);
    const entryPath = path.join(entryDir, "index.md");

    const props: Record<string, string> = {};
    for (let i = 0; i < data.headers.length; i++) {
      props[data.headers[i]] = normalized[i] ?? "";
    }

    fs.mkdirSync(entryDir, { recursive: true });
    fs.writeFileSync(entryPath, `# ${entryTitle}\n\n${buildPropertyTable(props)}\n\n---\n\n`, "utf-8");

    created++;
    entryLinks.push(`${created}. [${entryTitle}](${entrySlug}/index.md)`);
  }

  if (entryLinks.length > 0) {
    fs.appendFileSync(dbFilePath, `${entryLinks.join("\n")}\n`, "utf-8");
  }

  if (hostEditor.isActiveEditorDocumentEqualTo(document)) {
    const linkText = `[${dbName}](${dbRelPath})`;
    const lineText = document.lineAt(position.line).text;
    const hasSlashTrigger = position.character > 0 && lineText[position.character - 1] === "/";

    if (sourceLabel === "table" && data.startLine !== undefined && data.endLine !== undefined) {
      if (hasSlashTrigger) {
        await hostEditor.replaceRange(new Range(position.translate(0, -1), position), "");
      }

      if (opts?.deleteSourceTable) {
        const tableRange = new Range(
          new Position(data.startLine, 0),
          new Position(data.endLine, document.lineAt(data.endLine).text.length),
        );
        await hostEditor.replaceRange(tableRange, linkText);
      } else {
        await hostEditor.insertAt(new Position(data.startLine, 0), `${linkText}\n`);
      }
    } else {
      const start = hasSlashTrigger ? position.translate(0, -1) : position;
      await hostEditor.replaceRange(new Range(start, position), linkText);
    }

    await hostEditor.saveActiveDocument();
  }

  const dbDoc = await hostEditor.openTextDocument(dbFilePath);
  await hostEditor.showTextDocument(dbDoc);
  hostEditor.showInformation(`Imported ${created} entr${created === 1 ? "y" : "ies"} from ${sourceLabel}.`);
}

/**
 * `/table-to-db` — find the markdown table around the cursor, prompt for
 * each column's database type, then create a new sibling-folder database
 * (with a `lotion-db` schema fence) and one child entry per row. Removes
 * the original markdown table so the data lives only in the new DB.
 */
export async function handleTableToDbCommand(document: TextDocument, position: Position): Promise<void> {
  const parsed = parseMarkdownTableAtCursor(document, position);
  if (!parsed) {
    hostEditor.showWarning("Place cursor inside a valid markdown table to import.");
    return;
  }

  const tableAction = await hostEditor.showQuickPick(
    [
      { label: "Delete", description: "Import and replace the table with the DB link" },
      { label: "Keep", description: "Import and keep the table (DB link inserted above)" },
    ],
    { placeHolder: "Delete original table after import?" },
  );
  if (!tableAction) {
    return;
  }

  await createDatabaseFromTabularData(document, position, parsed, "table", {
    deleteSourceTable: tableAction.label === "Delete",
  });
}

export async function handleCsvToDbCommand(document: TextDocument, position: Position): Promise<void> {
  const uris = await hostEditor.showOpenDialog({
    canSelectMany: false,
    filters: { CSV: ["csv"], Text: ["txt"] },
    openLabel: "Select CSV file",
  });
  if (!uris || uris.length === 0) {
    return;
  }

  const csvPath = uris[0].fsPath;
  if (!fs.existsSync(csvPath)) {
    hostEditor.showError("Selected CSV file was not found.");
    return;
  }

  const rows = parseCsvText(fs.readFileSync(csvPath, "utf-8"));
  if (rows.length < 1) {
    hostEditor.showWarning("CSV appears to be empty.");
    return;
  }

  const headerPick = await hostEditor.showQuickPick(
    [
      { label: "Yes", description: "First row is a header row" },
      { label: "No", description: "First row is data" },
    ],
    { placeHolder: "Is the first CSV row a header row?" },
  );
  if (!headerPick) {
    return;
  }
  if (headerPick.label === "No") {
    hostEditor.showWarning("CSV import requires a header row. Please add one, then retry.");
    return;
  }

  const headers = normalizeTabularHeaders(rows[0]);
  const bodyRows = rows.slice(1).map((row) => normalizeRowWidth(row, headers.length));
  await createDatabaseFromTabularData(document, position, { headers, rows: bodyRows }, "csv");
}

export async function handleJsonToDbCommand(document: TextDocument, position: Position): Promise<void> {
  const uris = await hostEditor.showOpenDialog({
    canSelectMany: false,
    filters: { JSON: ["json"], Text: ["txt"] },
    openLabel: "Select JSON file",
  });
  if (!uris || uris.length === 0) {
    return;
  }

  const jsonPath = uris[0].fsPath;
  if (!fs.existsSync(jsonPath)) {
    hostEditor.showError("Selected JSON file was not found.");
    return;
  }

  let tabular;
  try {
    tabular = parseJsonToTabular(fs.readFileSync(jsonPath, "utf-8"));
  } catch (e) {
    if (e instanceof JsonImportError) {
      hostEditor.showError(`Lotion: ${e.message}`);
      return;
    }
    throw e;
  }

  if (tabular.headers.length === 0 || tabular.rows.length === 0) {
    hostEditor.showWarning("JSON appears to be empty.");
    return;
  }

  const normalizedHeaders = normalizeTabularHeaders(tabular.headers);
  const normalizedRows = tabular.rows.map((row) => normalizeRowWidth(row, normalizedHeaders.length));
  await createDatabaseFromTabularData(document, position, { headers: normalizedHeaders, rows: normalizedRows }, "json");
}
