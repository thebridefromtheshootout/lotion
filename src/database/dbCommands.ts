import * as path from "path";
import * as fs from "fs";
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { getCwd } from "../core/cwd";
import { DbColumn, DbSchema, SCHEMA_FENCE_START, SCHEMA_FENCE_END, parseSchemaFromText, serializeSchema } from "./dbSchema";
import { DbFilterOperator, DbView, DbViewFilter, parseViewsFromFile, saveViewsToFile, serializeViews } from "./dbViews";
import { parsePropertyTable, updateEntryProperty, buildPropertyTable, appendToLogTable, clearPropertyFields } from "./dbFrontmatter";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";
import { cursorInDb } from "./dbEntries";

export const DATABASE_SLASH_COMMAND: SlashCommand = {
  label: "/database",
  insertText: "",
  detail: "\ud83d\uddc4\ufe0f Create a database (typed table)",
  isAction: true,
  commandId: Cmd.createDatabase,
  kind: 21,
  handler: handleDatabaseCommand,
};

export const NEW_ENTRY_SLASH_COMMAND: SlashCommand = {
  label: "/new-entry",
  insertText: "",
  detail: "\u2795 Add a new database entry",
  isAction: true,
  commandId: Cmd.dbAddEntry,
  when: cursorInDb,
  dbOnly: true,
  kind: 12,
};

export const NEW_VIEW_SLASH_COMMAND: SlashCommand = {
  label: "/new-view",
  insertText: "",
  detail: "\ud83d\udc41\ufe0f Create a saved view with sort & filter",
  isAction: true,
  commandId: Cmd.dbNewView,
  when: cursorInDb,
  dbOnly: true,
  kind: 21,
  handler: handleNewViewCommand,
};

export const NEW_FIELD_SLASH_COMMAND: SlashCommand = {
  label: "/new-field",
  insertText: "",
  detail: "\u2795 Add a new field to the schema",
  isAction: true,
  commandId: Cmd.dbNewField,
  when: cursorInDb,
  dbOnly: true,
  kind: 4,
  handler: handleNewFieldCommand,
};

export const DELETE_FIELD_SLASH_COMMAND: SlashCommand = {
  label: "/delete-field",
  insertText: "",
  detail: "\ud83d\uddd1\ufe0f Remove a field from the schema",
  isAction: true,
  commandId: Cmd.dbDeleteField,
  when: cursorInDb,
  dbOnly: true,
  kind: 4,
  handler: handleDeleteFieldCommand,
};

// ── /database handler — create a new database ──────────────────────

export async function handleDatabaseCommand(document: TextDocument, position: Position): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  // 1. Ask for database name
  const dbName = await hostEditor.showInputBox({
    prompt: "Database name",
    placeHolder: "Projects",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Name cannot be empty";
      }
      if (Regex.invalidPathChars.test(v)) {
        return "Contains invalid characters";
      }
      return undefined;
    },
  });
  if (!dbName) {
    return;
  }

  // 2. Ask for the title field label (the field that holds the page/entry name)
  const titleField = await hostEditor.showInputBox({
    prompt: "What should the title / name field be called?",
    placeHolder: "Name",
    value: "Name",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Field name cannot be empty";
      }
      return undefined;
    },
  });
  if (!titleField) {
    return;
  }

  // 3. Ask for columns (comma-separated)
  const colsInput = await hostEditor.showInputBox({
    prompt: "Column names (comma-separated)",
    placeHolder: "Status, Priority, Due Date",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Provide at least one column";
      }
      return undefined;
    },
  });
  if (!colsInput) {
    return;
  }

  const colNames = colsInput
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 4. For each column, ask for type
  const columns: DbColumn[] = [];
  for (const name of colNames) {
    const typePick = await hostEditor.showQuickPick(
      [
        { label: "text", description: "Free text" },
        { label: "number", description: "Numeric value" },
        { label: "select", description: "Single choice from options" },
        { label: "multi-select", description: "Multiple choices from options" },
        { label: "date", description: "Date value (YYYY-MM-DD)" },
        { label: "checkbox", description: "True / false" },
        { label: "url", description: "URL / link" },
        { label: "coordinates", description: "Geographic coordinates (lat, lng)" },
      ],
      { placeHolder: `Type for column "${name}"` },
    );
    if (!typePick) {
      return;
    }

    const col: DbColumn = { name, type: typePick.label as DbColumn["type"] };

    // Ask for options if select/multi-select
    if (col.type === "select" || col.type === "multi-select") {
      const optionsInput = await hostEditor.showInputBox({
        prompt: `Options for "${name}" (comma-separated)`,
        placeHolder: "Option 1, Option 2, Option 3",
      });
      if (optionsInput) {
        col.options = optionsInput
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    }

    columns.push(col);
  }

  const schema: DbSchema = { columns, titleField: titleField.trim() };

  // 5. Create the database child page
  const slug = dbName
    .toLowerCase()
    .replace(Regex.whitespaceRun, "-")
    .replace(Regex.slugUnsafeChars, "");
  const dbDir = path.join(cwd, slug);
  const dbFilePath = path.join(dbDir, "index.md");
  const relativePath = `${slug}/index.md`;

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const schemaYaml = serializeSchema(schema);
  const dbContent = `# ${dbName}\n\n\`\`\`lotion-db\n${schemaYaml}\n\`\`\`\n\n---\n\n`;
  fs.writeFileSync(dbFilePath, dbContent, "utf-8");

  // 6. Insert link in the current document
  if (hostEditor.isActiveEditorDocumentEqualTo(document)) {
    const triggerRange = new Range(position.translate(0, -1), position);
    await hostEditor.replaceRange(triggerRange, `[${dbName}](${relativePath})`);
    await hostEditor.saveActiveDocument();
  }

  // 7. Open the database page
  const dbDoc = await hostEditor.openTextDocument(dbFilePath);
  await hostEditor.showTextDocument(dbDoc);

  hostEditor.showInformation(`Database "${dbName}" created with ${columns.length} column(s).`);
}

// ── /db-entry handler — create a new entry in a database ───────────

/**
 * Detects whether the current file is a database index.md (has a lotion-db block),
 * then prompts for property values and creates a child entry page.
 *
 * @param fromSlashCommand If true, replaces the `/` trigger character at position.
 *   If false (e.g. webview), appends the link at the end of the file.
 */
export async function handleDbEntryCommand(
  document: TextDocument,
  position: Position,
  fromSlashCommand: boolean = true,
  defaults: Record<string, string> = {},
): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  // Parse schema from current document
  const schema = parseSchemaFromText(document.getText());
  if (!schema) {
    hostEditor.showError("Lotion: no lotion-db schema found in this file.");
    return;
  }

  const entryInput = await promptDbEntryInput(schema, defaults);
  if (!entryInput) {
    return;
  }
  const { entryTitle, props } = entryInput;

  // 3. Create child entry page
  const slug = entryTitle
    .toLowerCase()
    .replace(Regex.whitespaceRun, "-")
    .replace(Regex.slugUnsafeChars, "");
  const entryDir = path.join(cwd, slug);
  const entryFilePath = path.join(entryDir, "index.md");
  const relativePath = `${slug}/index.md`;

  if (fs.existsSync(entryFilePath)) {
    hostEditor.showError(`Entry "${slug}" already exists.`);
    return;
  }

  if (!fs.existsSync(entryDir)) {
    fs.mkdirSync(entryDir, { recursive: true });
  }

  // Build entry content: heading then property table
  const entryContent = `# ${entryTitle}\n\n${buildPropertyTable(props)}\n`;
  fs.writeFileSync(entryFilePath, entryContent, "utf-8");

  // 4. Append bullet link in the current database index.md
  const link = `- [${entryTitle}](${relativePath})`;
  if (fromSlashCommand) {
    // Called from slash command — context-aware replacement near cursor.
    if (hostEditor.isActiveEditorDocumentEqualTo(document)) {
      const line = document.lineAt(position.line);
      const lineText = line.text;
      const cursorCol = Math.min(position.character, lineText.length);
      const slashIdx = lineText.lastIndexOf("/", Math.max(cursorCol - 1, 0));
      const rawLink = `[${entryTitle}](${relativePath})`;

      const markerOnlyUnordered = /^(\s*[-*+]\s)$/;
      const markerOnlyOrdered = /^(\s*\d+[.)]\s)$/;
      const markerOnlyCheckbox = /^(\s*[-*+]\s\[[ xX]\]\s)$/i;

      if (slashIdx !== -1) {
        const before = lineText.slice(0, slashIdx);
        const after = lineText.slice(slashIdx + 1);

        let replacementLine: string;
        if (
          markerOnlyUnordered.test(before) ||
          markerOnlyOrdered.test(before) ||
          markerOnlyCheckbox.test(before)
        ) {
          // Line already has list marker prefix, so only inject the link payload.
          replacementLine = `${before}${rawLink}${after}`;
        } else if (before.trim().length === 0) {
          // Empty/whitespace line -> create bullet entry.
          replacementLine = `${before}- ${rawLink}${after}`;
        } else {
          // Normal text context -> inject plain link payload.
          replacementLine = `${before}${rawLink}${after}`;
        }

        await hostEditor.replaceRange(line.range, replacementLine);
      } else if (
        markerOnlyUnordered.test(lineText) ||
        markerOnlyOrdered.test(lineText) ||
        markerOnlyCheckbox.test(lineText)
      ) {
        await hostEditor.replaceRange(line.range, `${lineText}${rawLink}`);
      } else if (lineText.trim().length === 0) {
        const indent = lineText.match(Regex.lineIndent)?.[1] ?? "";
        await hostEditor.replaceRange(line.range, `${indent}- ${rawLink}`);
      } else {
        await hostEditor.insertAt(position, rawLink);
      }
      await hostEditor.saveActiveDocument();
    }
  } else {
    // Called from webview or command palette — append directly to file
    const dbFilePath = document.uri.fsPath;
    const existing = fs.readFileSync(dbFilePath, "utf-8");
    const suffix = existing.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(dbFilePath, existing + suffix + link + "\n", "utf-8");
  }

  // 5. Open the entry page
  const entryDoc = await hostEditor.openTextDocument(entryFilePath);
  await hostEditor.showTextDocument(entryDoc);

  hostEditor.showInformation(`Entry "${entryTitle}" created.`);
}

async function promptDbEntryInput(
  schema: DbSchema,
  defaults: Record<string, string>,
): Promise<{ entryTitle: string; props: Record<string, string> } | undefined> {
  const entryTitle = await hostEditor.showInputBox({
    prompt: "Entry title",
    placeHolder: "New entry",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Title cannot be empty";
      }
      return undefined;
    },
  });
  if (!entryTitle) {
    return undefined;
  }

  const props: Record<string, string> = {};
  for (const col of schema.columns) {
    const defaultValue = getDefaultValueForColumn(col, defaults);
    const value = await promptForColumnValue(col, defaultValue);
    if (value === undefined) {
      return undefined;
    }
    props[col.name] = value;
  }

  return { entryTitle, props };
}

// ── Column value prompters ─────────────────────────────────────────

export async function promptForColumnValue(col: DbColumn, defaultValue?: string): Promise<string | undefined> {
  switch (col.type) {
    case "text":
    case "number":
    case "url":
      return hostEditor
        .showInputBox({
          prompt: `${col.name} (${col.type})`,
          value: defaultValue,
          placeHolder: col.type === "number" ? "0" : "",
          validateInput:
            col.type === "number"
              ? (v) => {
                  if (!v || v.trim().length === 0) {
                    return `${col.name} is required`;
                  }
                  if (isNaN(Number(v))) {
                    return "Must be a number";
                  }
                  return undefined;
                }
              : (v) => (!v || v.trim().length === 0 ? `${col.name} is required` : undefined),
        })
        .then((v) => v ?? undefined);

    case "date":
      return hostEditor
        .showInputBox({
          prompt: `${col.name} (YYYY-MM-DD)`,
          value: defaultValue,
          placeHolder: new Date().toISOString().slice(0, 10),
          validateInput: (v) => {
            if (!v || v.trim().length === 0) {
              return `${col.name} is required`;
            }
            if (!Regex.isoDateYmd.test(v)) {
              return "Use YYYY-MM-DD format";
            }
            return undefined;
          },
        })
        .then((v) => v ?? undefined);

    case "checkbox":
      return hostEditor
        .showQuickPick([{ label: "true" }, { label: "false" }], { placeHolder: col.name })
        .then((v) => v?.label);

    case "select":
      if (col.options && col.options.length > 0) {
        return hostEditor
          .showQuickPick(
            col.options.map((o) => ({ label: o })),
            { placeHolder: col.name },
          )
          .then((v) => v?.label);
      }
      return hostEditor.showInputBox({ prompt: col.name, value: defaultValue }).then((v) => v ?? undefined);

    case "multi-select":
      if (col.options && col.options.length > 0) {
        const picks = await hostEditor.showQuickPick(
          col.options.map((o) => ({ label: o })),
          { placeHolder: `${col.name} (select at least one)`, canPickMany: true },
        );
        if (!picks || picks.length === 0) {
          hostEditor.showWarning(`${col.name} requires at least one selection.`);
          return undefined;
        }
        return picks.map((p) => p.label).join(", ");
      }
      return hostEditor
        .showInputBox({
          prompt: `${col.name} (comma-separated)`,
          value: defaultValue,
          validateInput: (v) => (!v || v.trim().length === 0 ? `${col.name} is required` : undefined),
        })
        .then((v) => v ?? undefined);

    case "image":
      return hostEditor
        .showInputBox({
          prompt: `${col.name} — path to image in .rsrc (e.g. .rsrc/photo.png)`,
          value: defaultValue,
          placeHolder: ".rsrc/image.png",
        })
        .then((v) => v ?? undefined);

    case "coordinates":
      return hostEditor
        .showInputBox({
          prompt: `${col.name} (lat, lng)`,
          value: defaultValue,
          placeHolder: "48.8566, 2.3522",
          validateInput: (v) => {
            if (!v || v.trim().length === 0) {
              return `${col.name} is required`;
            }
            const parts = v.split(",").map((p) => p.trim());
            if (parts.length !== 2 || parts.some((p) => isNaN(Number(p)))) {
              return "Use lat, lng format (e.g. 48.8566, 2.3522)";
            }
            return undefined;
          },
        })
        .then((v) => v ?? undefined);

    default:
      return "";
  }
}

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

// ── /new-field handler ─────────────────────────────────────────────

export async function handleNewFieldCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaFromText(document.getText());
  if (!schema) {
    hostEditor.showError("Lotion: no lotion-db schema found in this file.");
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

  // 2. Ask for type
  const typePick = await hostEditor.showQuickPick(
    [
      { label: "text", description: "Free text" },
      { label: "number", description: "Numeric value" },
      { label: "select", description: "Single choice from options" },
      { label: "multi-select", description: "Multiple choices from options" },
      { label: "date", description: "Date value (YYYY-MM-DD)" },
      { label: "checkbox", description: "True / false" },
      { label: "url", description: "URL / link" },
      { label: "image", description: "Image path (relative to .rsrc)" },
      { label: "coordinates", description: "Geographic coordinates (lat, lng)" },
    ],
    { placeHolder: `Type for "${name.trim()}"` },
  );
  if (!typePick) {
    return;
  }

  const col: DbColumn = { name: name.trim(), type: typePick.label as DbColumn["type"] };

  // 3. Ask for options if select/multi-select
  if (col.type === "select" || col.type === "multi-select") {
    const optionsInput = await hostEditor.showInputBox({
      prompt: `Options for "${col.name}" (comma-separated)`,
      placeHolder: "Option 1, Option 2, Option 3",
      validateInput: (v) => (!v || v.trim().length === 0 ? "At least one option is required" : undefined),
    });
    if (!optionsInput) {
      return;
    }
    col.options = optionsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // 3b. Ask for maxWidth/maxHeight if image
  if (col.type === "image") {
    const mw = await hostEditor.showInputBox({
      prompt: `Max image width in px for "${col.name}" (leave blank for default 120)`,
      placeHolder: "120",
    });
    if (mw && /^\d+$/.test(mw.trim())) {
      col.maxWidth = parseInt(mw.trim(), 10);
    }

    const mh = await hostEditor.showInputBox({
      prompt: `Max image height in px for "${col.name}" (leave blank for default 80)`,
      placeHolder: "80",
    });
    if (mh && /^\d+$/.test(mh.trim())) {
      col.maxHeight = parseInt(mh.trim(), 10);
    }
  }

  // 4. Replace schema block in document
  schema.columns.push(col);
  const blockRange = findSchemaBlockRange(document);
  if (!blockRange) {
    return;
  }

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const range = new Range(blockRange.startLine + 1, 0, blockRange.endLine, 0);
  const newYaml = serializeSchema(schema) + "\n";
  await hostEditor.replaceRange(range, newYaml);
  await hostEditor.saveActiveDocument();

  hostEditor.showInformation(`Field "${col.name}" (${col.type}) added to database.`);
}

// ── /delete-field handler ──────────────────────────────────────────

export async function handleDeleteFieldCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaFromText(document.getText());
  if (!schema) {
    hostEditor.showError("Lotion: no lotion-db schema found in this file.");
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
    `Delete field "${pick.label}"? This removes it from the schema (existing entry data is not modified).`,
    ["Delete", "Cancel"],
  );
  if (confirm !== "Delete") {
    return;
  }

  // 3. Remove from schema and rewrite
  schema.columns = schema.columns.filter((c) => c.name !== pick.label);
  const blockRange = findSchemaBlockRange(document);
  if (!blockRange) {
    return;
  }

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const range = new Range(blockRange.startLine + 1, 0, blockRange.endLine, 0);
  const newYaml = schema.columns.length > 0 ? serializeSchema(schema) + "\n" : "";
  await hostEditor.replaceRange(range, newYaml);
  await hostEditor.saveActiveDocument();

  hostEditor.showInformation(`Field "${pick.label}" removed from schema.`);
}

// ── /new-view handler ──────────────────────────────────────────────

/**
 * Prompts for sort column, sort direction, filter settings, and view name,
 * then saves a new DbView into the lotion-db-views block.
 */
export async function handleNewViewCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaFromText(document.getText());
  if (!schema) {
    hostEditor.showError("Lotion: no lotion-db schema found in this file.");
    return;
  }

  const columnNames = schema.columns.map((c) => c.name);
  const allFields = ["__title", ...columnNames];

  // 1. Ask for sort column (optional)
  const sortPick = await hostEditor.showQuickPick(
    [
      { label: "(none)", description: "No sorting" },
      ...allFields.map((f) => ({
        label: f === "__title" ? "Title" : f,
        description: f === "__title" ? "Entry title" : `Column: ${f}`,
      })),
    ],
    { placeHolder: "Sort by column (optional)" },
  );
  if (!sortPick) {
    return;
  }

  let sortCol: string | null = null;
  let sortDir: "asc" | "desc" = "asc";

  if (sortPick.label !== "(none)") {
    sortCol = sortPick.label === "Title" ? "__title" : sortPick.label;

    // 2. Ask for sort direction
    const dirPick = await hostEditor.showQuickPick(
      [
        { label: "asc", description: "Ascending (A → Z, 0 → 9)" },
        { label: "desc", description: "Descending (Z → A, 9 → 0)" },
      ],
      { placeHolder: "Sort direction" },
    );
    if (!dirPick) {
      return;
    }
    sortDir = dirPick.label as "asc" | "desc";
  }

  // 3. Ask for filters (can add multiple)
  const filters: DbViewFilter[] = [];
  let addMore = true;
  while (addMore) {
    const filterAction = await hostEditor.showQuickPick(
      [
        {
          label: "Add filter",
          description: `(${filters.length} filter${filters.length !== 1 ? "s" : ""} added so far)`,
        },
        { label: "Done", description: "Finish adding filters" },
      ],
      { placeHolder: "Add a filter?" },
    );
    if (!filterAction || filterAction.label === "Done") {
      addMore = false;
      break;
    }

    const filterColPick = await hostEditor.showQuickPick(
      allFields.map((f) => ({
        label: f === "__title" ? "Title" : f,
        description: f === "__title" ? "Entry title" : `Column: ${f}`,
      })),
      { placeHolder: "Filter on which column?" },
    );
    if (!filterColPick) {
      addMore = false;
      break;
    }

    const filterCol = filterColPick.label === "Title" ? "__title" : filterColPick.label;

    // Ask for operator
    const opPick = await hostEditor.showQuickPick(
      [
        { label: "contains", description: "Value contains text" },
        { label: "!contains", description: "Value does NOT contain text" },
        { label: "==", description: "Equals exactly" },
        { label: "!=", description: "Not equal to" },
        { label: "startswith", description: "Starts with" },
        { label: "!startswith", description: "Does not start with" },
        { label: "endswith", description: "Ends with" },
        { label: "!endswith", description: "Does not end with" },
        { label: ">", description: "Greater than (numeric/date)" },
        { label: ">=", description: "Greater than or equal" },
        { label: "<", description: "Less than (numeric/date)" },
        { label: "<=", description: "Less than or equal" },
        { label: "between", description: "Between two values (comma-separated)" },
        { label: "in", description: "Value is one of (comma-separated list)" },
        { label: "!in", description: "Value is NOT one of (comma-separated)" },
        { label: "has_any", description: "Multi-select has any of (comma-separated)" },
        { label: "has_all", description: "Multi-select has all of (comma-separated)" },
        { label: "matches_regex", description: "Matches a regular expression" },
        { label: "isempty", description: "Value is empty / not set" },
        { label: "isnotempty", description: "Value is not empty" },
      ],
      { placeHolder: `Operator for "${filterCol}"` },
    );
    if (!opPick) {
      addMore = false;
      break;
    }
    const filterOp = opPick.label as DbFilterOperator;

    // For isempty/isnotempty, no value needed
    if (filterOp === "isempty" || filterOp === "isnotempty") {
      filters.push({ col: filterCol, op: filterOp, value: "" });
      continue;
    }

    // For select/multi-select columns, offer the options as choices
    const colDef = schema.columns.find((c) => c.name === filterCol);
    let filterValue: string | undefined;

    if (colDef && (colDef.type === "select" || colDef.type === "multi-select") && colDef.options?.length) {
      if (filterOp === "in" || filterOp === "!in" || filterOp === "has_any" || filterOp === "has_all") {
        const picks = await hostEditor.showQuickPick(
          colDef.options.map((o) => ({ label: o })),
          { placeHolder: `Values for "${filterCol}" (${filterOp})`, canPickMany: true },
        );
        filterValue = picks ? picks.map((p) => p.label).join(", ") : undefined;
      } else {
        const valPick = await hostEditor.showQuickPick(
          colDef.options.map((o) => ({ label: o })),
          { placeHolder: `Filter value for "${filterCol}"` },
        );
        filterValue = valPick?.label;
      }
    } else {
      const placeholder =
        filterOp === "between"
          ? "min, max"
          : filterOp === "in" || filterOp === "!in"
            ? "value1, value2, ..."
            : filterOp === "matches_regex"
              ? "regex pattern"
              : "Value to match";
      filterValue = await hostEditor.showInputBox({
        prompt: `Filter value for "${filterCol}" (${filterOp})`,
        placeHolder: placeholder,
      });
    }

    if (filterValue === undefined) {
      addMore = false;
      break;
    }
    filters.push({ col: filterCol, op: filterOp, value: filterValue });
  }

  // 4. Ask for view name
  const viewName = await hostEditor.showInputBox({
    prompt: "View name",
    placeHolder: "e.g. Active Tasks, By Priority",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Name cannot be empty";
      }
      return undefined;
    },
  });
  if (!viewName) {
    return;
  }

  // 5. Build and save the view
  const newView: DbView = {
    name: viewName.trim(),
    sortCol,
    sortDir,
    filters,
  };

  const filePath = document.uri.fsPath;
  const existingViews = parseViewsFromFile(filePath);

  // Check for duplicate name
  if (existingViews.some((v) => v.name === newView.name)) {
    const overwrite = await hostEditor.showWarningMessage(`A view named "${newView.name}" already exists. Overwrite?`, [
      "Overwrite",
      "Cancel",
    ]);
    if (overwrite !== "Overwrite") {
      return;
    }
    const idx = existingViews.findIndex((v) => v.name === newView.name);
    existingViews[idx] = newView;
  } else {
    existingViews.push(newView);
  }

  saveViewsToFile(filePath, existingViews);

  // Reload to show updated content
  const updatedDoc = await hostEditor.openTextDocument(filePath);
  await hostEditor.showTextDocument(updatedDoc);

  hostEditor.showInformation(`View "${newView.name}" saved.`);
}

// ── Log entry flow ─────────────────────────────────────────────────

/**
 * Log entry: move current frontmatter values to a history table in the .md file,
 * clear them, and prompt for new values.
 */
export async function logEntryAndPromptNew(entryFilePath: string, columns: DbColumn[]): Promise<void> {
  if (!fs.existsSync(entryFilePath)) {
    return;
  }

  let content: string = fs.readFileSync(entryFilePath, "utf-8");
  const properties = parsePropertyTable(content);
  if (!properties) {
    hostEditor.showWarning("No property table found in entry.");
    return;
  }

  // Collect current values
  const fieldNames = columns.map((c) => c.name);
  const currentValues: string[] = fieldNames.map((name) => properties[name] || "");

  // Append to log table (or create it)
  content = appendToLogTable(content, fieldNames, currentValues);

  // Clear property table fields
  content = clearPropertyFields(content, fieldNames);

  // Write intermediate state
  fs.writeFileSync(entryFilePath, content, "utf-8");

  // Prompt user for new values
  for (const col of columns) {
    const val = await promptForColumnValue(col);
    if (val === undefined) {
      // User cancelled, leave field empty
      continue;
    }
    updateEntryProperty(entryFilePath, col.name, val);
  }
}

function getDefaultValueForColumn(col: DbColumn, defaults: Record<string, string>): string | undefined {
  const providedDefault = defaults[col.name];
  if (providedDefault !== undefined) {
    return providedDefault;
  }
  if (col.type === "date") {
    const today = new Date().toISOString().slice(0, 10);
    return today;
  }
}
