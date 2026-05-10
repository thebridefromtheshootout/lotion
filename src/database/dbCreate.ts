import * as path from "path";
import * as fs from "fs";
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { getCwd } from "../core/cwd";
import { DbColumn, DbSchema, serializeSchema } from "./dbSchema";
import { Regex } from "../core/regex";
import { Markers } from "../core/markers";
import { toPathSlug } from "../core/slug";
import { promptColumnDefinition } from "./dbColumnPrompt";

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
    const col = await promptColumnDefinition(name, {
      includeImageType: false,
      requireOptionsForSelect: false,
      includeImageDimensions: false,
      typePlaceholder: `Type for column "${name}"`,
    });
    if (!col) {
      return;
    }
    columns.push(col);
  }

  const schema: DbSchema = { columns, titleField: titleField.trim() };

  // 5. Create the database child page
  const slug = toPathSlug(dbName);
  const dbDir = path.join(cwd, slug);
  const dbFilePath = path.join(dbDir, "index.md");
  const relativePath = `${slug}/index.md`;

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const schemaYaml = serializeSchema(schema);
  const dbContent = `# ${dbName}\n\n\`\`\`${Markers.dbFenceLang}\n${schemaYaml}\n\`\`\`\n\n---\n\n`;
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
