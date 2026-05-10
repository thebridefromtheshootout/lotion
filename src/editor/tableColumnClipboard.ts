import { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { getColumnAtCursor, getTableRange, parseTable, replaceTable } from "./tableCore";

// ── Column clipboard payload ───────────────────────────────────────

interface TableColumnClipboardPayload {
  __lotionTableColumn: true;
  header: string;
  rows: string[];
}

// ── Copy / cut / paste column ──────────────────────────────────────

export async function copyCurrentTableColumnToClipboard(
  cut = false,
  opts?: { document?: TextDocument; position?: Position },
): Promise<boolean> {
  const document = opts?.document ?? hostEditor.getDocument();
  const position = opts?.position ?? hostEditor.getCursorPosition();
  if (!document || !position) {
    return false;
  }

  const range = getTableRange(document, position.line);
  if (!range) {
    return false;
  }
  const table = parseTable(document, range);
  if (!table) {
    return false;
  }

  const lineText = document.lineAt(position.line).text;
  const colIndex = getColumnAtCursor(lineText, position.character);
  if (colIndex >= table.headers.length) {
    return false;
  }

  const payload: TableColumnClipboardPayload = {
    __lotionTableColumn: true,
    header: table.headers[colIndex] ?? "",
    rows: table.rows.map((row) => row[colIndex] ?? ""),
  };
  await hostEditor.writeClipboardText(JSON.stringify(payload));

  if (!cut) {
    return true;
  }
  if (table.headers.length <= 1) {
    hostEditor.showWarning("Cannot cut the last column.");
    return false;
  }

  table.headers.splice(colIndex, 1);
  for (const row of table.rows) {
    row.splice(colIndex, 1);
  }

  await replaceTable(document, range, table.headers, table.rows);
  return true;
}

export function parseTableColumnClipboard(text: string): { header: string; rows: string[] } | undefined {
  try {
    const parsed = JSON.parse(text) as Partial<TableColumnClipboardPayload>;
    if (
      !parsed ||
      parsed.__lotionTableColumn !== true ||
      typeof parsed.header !== "string" ||
      !Array.isArray(parsed.rows) ||
      !parsed.rows.every((r) => typeof r === "string")
    ) {
      return undefined;
    }
    return { header: parsed.header, rows: parsed.rows };
  } catch {
    return undefined;
  }
}

export async function pasteTableColumnAtCursor(
  document: TextDocument,
  position: Position,
  payload: { header: string; rows: string[] },
): Promise<boolean> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return false;
  }
  const range = getTableRange(document, position.line);
  if (!range) {
    return false;
  }
  const table = parseTable(document, range);
  if (!table) {
    return false;
  }

  const lineText = document.lineAt(position.line).text;
  const currentCol = Math.min(getColumnAtCursor(lineText, position.character), table.headers.length - 1);
  const insertAt = currentCol + 1;

  while (table.rows.length < payload.rows.length) {
    table.rows.push(Array.from({ length: table.headers.length }, () => ""));
  }

  table.headers.splice(insertAt, 0, payload.header || "Col");
  for (let i = 0; i < table.rows.length; i++) {
    const value = i < payload.rows.length ? payload.rows[i] : "";
    table.rows[i].splice(insertAt, 0, value);
  }

  await replaceTable(document, range, table.headers, table.rows);
  return true;
}

// ── /copy-column /cut-column /paste-column slash handlers ──────────

export async function handleCopyColumn(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const copied = await copyCurrentTableColumnToClipboard(false, { document, position });
  if (!copied) {
    hostEditor.showWarning("Place cursor inside a table to copy a column.");
  }
}

export async function handleCutColumn(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const cut = await copyCurrentTableColumnToClipboard(true, { document, position });
  if (!cut) {
    hostEditor.showWarning("Place cursor inside a table to cut a column.");
  }
}

export async function handlePasteColumn(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }
  const clipText = await hostEditor.getClipboardText();
  const payload = parseTableColumnClipboard(clipText);
  if (!payload) {
    hostEditor.showWarning("Clipboard does not contain a copied table column.");
    return;
  }
  const pasted = await pasteTableColumnAtCursor(document, position, payload);
  if (!pasted) {
    hostEditor.showWarning("Place cursor inside a table to paste a column.");
  }
}
