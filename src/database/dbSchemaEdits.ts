import * as path from "path";
import * as fs from "fs";
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import {
  DbSchema,
  SCHEMA_FENCE_START,
  SCHEMA_FENCE_END,
  parseSchemaFromText,
  serializeSchema,
} from "./dbSchema";
import {
  updateEntryProperty,
  removePropertyFields,
  renamePropertyField,
  syncPropertyFieldOrder,
} from "./dbFrontmatter";
import { readDbEntries } from "./dbEntries";
import { promptColumnDefinition, promptForColumnValue } from "./dbColumnPrompt";

// ── Schema block range finder ──────────────────────────────────────

/**
 * Locate the ```lotion-db fenced block in the document and return its line range.
 */
function findSchemaBlockRange(document: TextDocument): { startLine: number; endLine: number } | undefined {
  let startLine = -1;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (SCHEMA_FENCE_START.test(line)) {
      startLine = i;
      continue;
    }
    if (startLine >= 0 && SCHEMA_FENCE_END.test(line)) {
      return { startLine, endLine: i };
    }
  }
  return undefined;
}

export function parseSchemaOrShowError(document: TextDocument): DbSchema | undefined {
  const schema = parseSchemaFromText(document.getText());
  if (!schema) {
    hostEditor.showError("Lotion: no lotion-db schema found in this file.");
    return undefined;
  }
  return schema;
}

async function replaceSchemaBlockContent(document: TextDocument, yamlContent: string): Promise<boolean> {
  const blockRange = findSchemaBlockRange(document);
  if (!blockRange) {
    return false;
  }
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return false;
  }
  const range = new Range(blockRange.startLine + 1, 0, blockRange.endLine, 0);
  await hostEditor.replaceRange(range, yamlContent);
  await hostEditor.saveActiveDocument();
  return true;
}

function getDbEntriesContext(document: TextDocument): { dbDir: string; entries: ReturnType<typeof readDbEntries> } {
  const dbDir = path.dirname(document.uri.fsPath);
  const entries = readDbEntries(dbDir);
  return { dbDir, entries };
}

function rewriteExistingEntryFiles(
  document: TextDocument,
  transform: (content: string) => string,
): { entriesCount: number; updatedEntries: number } {
  const { dbDir, entries } = getDbEntriesContext(document);
  let updatedEntries = 0;
  for (const entry of entries) {
    const entryPath = path.join(dbDir, entry.relativePath);
    if (!fs.existsSync(entryPath)) {
      continue;
    }
    const content = fs.readFileSync(entryPath, "utf-8");
    const next = transform(content);
    if (next !== content) {
      fs.writeFileSync(entryPath, next, "utf-8");
      updatedEntries++;
    }
  }
  return { entriesCount: entries.length, updatedEntries };
}

// ── /new-field handler ─────────────────────────────────────────────

/**
 * `/new-field` — prompt for a new column (name, type, optional `select`
 * options) and append it to the lotion-db schema fence in the current DB
 * index.md. Existing entries don't get the new property until they're
 * edited; the schema additionwon't synthesise default values.
 */
export async function handleNewFieldCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaOrShowError(document);
  if (!schema) {
    return;
  }

  // 1. Ask for field name
  const name = await hostEditor.showInputBox({
    prompt: "New field name",
    placeHolder: "e.g. Priority, Due Date",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Name is required";
      }
      if (schema.columns.some((c) => c.name === v.trim())) {
        return "A field with that name already exists";
      }
      return undefined;
    },
  });
  if (!name) {
    return;
  }

  // 2. Ask for type + settings (options/image dimensions)
  const col = await promptColumnDefinition(name.trim(), {
    includeImageType: true,
    requireOptionsForSelect: true,
    includeImageDimensions: true,
    typePlaceholder: `Type for "${name.trim()}"`,
  });
  if (!col) {
    return;
  }

  // 3c. Mandatory typed default backfill for existing entries
  const backfillValue = await promptForColumnValue(col, undefined, "backfill");
  if (backfillValue === undefined || backfillValue.trim().length === 0) {
    hostEditor.showWarning(`Cannot add "${col.name}" without a default backfill value for existing entries.`);
    return;
  }

  // 4. Replace schema block in document
  schema.columns.push(col);
  if (!(await replaceSchemaBlockContent(document, serializeSchema(schema) + "\n"))) {
    return;
  }

  // 5. Backfill existing entries in this database folder
  const { dbDir, entries } = getDbEntriesContext(document);
  for (const entry of entries) {
    const entryPath = path.join(dbDir, entry.relativePath);
    updateEntryProperty(entryPath, col.name, backfillValue);
  }

  hostEditor.showInformation(`Field "${col.name}" (${col.type}) added. Backfilled ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
}

// ── /delete-field handler ──────────────────────────────────────────

/**
 * `/delete-field` — pick a column from the lotion-db schema and remove it.
 * Also strips that column from every child entry's property table so the
 * entries don't keep the orphan field. Cannot remove the implicit title
 * column.
 */
export async function handleDeleteFieldCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaOrShowError(document);
  if (!schema) {
    return;
  }

  if (schema.columns.length === 0) {
    hostEditor.showInformation("No fields to delete.");
    return;
  }

  // 1. Ask which field to delete
  const pick = await hostEditor.showQuickPick(
    schema.columns.map((c) => ({
      label: c.name,
      description: c.type + (c.options ? ` [${c.options.join(", ")}]` : ""),
    })),
    { placeHolder: "Select field to delete" },
  );
  if (!pick) {
    return;
  }

  // 2. Confirm
  const confirm = await hostEditor.showWarningMessage(
    `Delete field "${pick.label}"? This removes it from the schema and all existing entries.`,
    ["Delete", "Cancel"],
  );
  if (confirm !== "Delete") {
    return;
  }

  // 3. Remove from schema and rewrite
  schema.columns = schema.columns.filter((c) => c.name !== pick.label);
  if (!(await replaceSchemaBlockContent(document, schema.columns.length > 0 ? serializeSchema(schema) + "\n" : ""))) {
    return;
  }

  // 4. Remove the field from existing entries in this database folder
  const { entriesCount } = rewriteExistingEntryFiles(document, (content) => removePropertyFields(content, [pick.label]));

  hostEditor.showInformation(`Field "${pick.label}" removed from schema and ${entriesCount} entr${entriesCount === 1 ? "y" : "ies"}.`);
}

// ── /rename-field handler ──────────────────────────────────────────

/**
 * `/rename-field` — pick a column and prompt for a new name. Updates the
 * lotion-db schema and renames the matching key in every child entry's
 * property table. Rejects names that collide with an existing column.
 */
export async function handleRenameFieldCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaOrShowError(document);
  if (!schema) {
    return;
  }

  if (schema.columns.length === 0) {
    hostEditor.showInformation("No fields to rename.");
    return;
  }

  const fromPick = await hostEditor.showQuickPick(
    schema.columns.map((c) => ({
      label: c.name,
      description: c.type + (c.options ? ` [${c.options.join(", ")}]` : ""),
    })),
    { placeHolder: "Select field to rename" },
  );
  if (!fromPick) {
    return;
  }

  const fromName = fromPick.label;
  const toNameInput = await hostEditor.showInputBox({
    prompt: `Rename "${fromName}" to`,
    value: fromName,
    placeHolder: "New field name",
    validateInput: (v) => {
      const next = (v ?? "").trim();
      if (next.length === 0) {
        return "Name is required";
      }
      if (next !== fromName && schema.columns.some((c) => c.name === next)) {
        return "A field with that name already exists";
      }
      return undefined;
    },
  });
  if (!toNameInput) {
    return;
  }

  const toName = toNameInput.trim();
  if (toName === fromName) {
    hostEditor.showInformation("Field name unchanged.");
    return;
  }

  schema.columns = schema.columns.map((c) => (c.name === fromName ? { ...c, name: toName } : c));
  if (schema.titleField === fromName) {
    schema.titleField = toName;
  }

  if (!(await replaceSchemaBlockContent(document, serializeSchema(schema) + "\n"))) {
    return;
  }
  const { updatedEntries } = rewriteExistingEntryFiles(document, (content) => renamePropertyField(content, fromName, toName));

  hostEditor.showInformation(
    `Field "${fromName}" renamed to "${toName}". Updated ${updatedEntries} entr${updatedEntries === 1 ? "y" : "ies"}.`,
  );
}

// ── /sync-field-order handler ──────────────────────────────────────

/**
 * `/sync-field-order` — rewrite each child entry's property table to use
 * the column order declared in the lotion-db schema. Useful after a
 * `/new-field` insertion in the middle of the schema, or when an entry's
 * property table has drifted from its siblings.
 */
export async function handleSyncFieldOrderCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaOrShowError(document);
  if (!schema) {
    return;
  }

  if (schema.columns.length === 0) {
    hostEditor.showInformation("No schema columns found to sync.");
    return;
  }

  const orderedFields = schema.columns.map((c) => c.name);
  const { updatedEntries } = rewriteExistingEntryFiles(document, (content) =>
    syncPropertyFieldOrder(content, orderedFields),
  );

  hostEditor.showInformation(
    `Field order synced to schema for ${updatedEntries} entr${updatedEntries === 1 ? "y" : "ies"}.`,
  );
}
