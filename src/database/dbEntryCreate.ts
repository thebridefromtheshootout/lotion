import * as path from "path";
import * as fs from "fs";
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { getCwd } from "../core/cwd";
import { DbColumn, DbSchema } from "./dbSchema";
import { buildPropertyTable } from "./dbFrontmatter";
import { Regex } from "../core/regex";
import { toPathSlug } from "../core/slug";
import { collectOrderedList, renumberEdits, applyRenumberEdits } from "../lists/listModel";
import type { ListNode } from "../lists/listModel";
import { promptForColumnValue } from "./dbColumnPrompt";
import { parseSchemaOrShowError } from "./dbSchemaEdits";
import { readDbEntries } from "./dbEntries";
import { validateEntry } from "./dbValidate";

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
  const schema = parseSchemaOrShowError(document);
  if (!schema) {
    return;
  }

  const entryInput = await promptDbEntryInput(schema, defaults);
  if (!entryInput) {
    return;
  }
  const { entryTitle, props } = entryInput;

  // Schema-level cross-entry checks (uniqueness). Per-cell validation has
  // already run inside the prompts; this catches violations that need the
  // rest of the DB to surface — chiefly `unique: true` collisions.
  const otherEntries = readDbEntries(cwd).map((e) => e.properties);
  const violations = validateEntry(schema, props, otherEntries);
  if (violations.length > 0) {
    hostEditor.showError(`Lotion: ${violations.map((v) => v.message).join("; ")}`);
    return;
  }

  // 3. Create child entry page
  const slug = toPathSlug(entryTitle);
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
  const entryContent = `# ${entryTitle}\n\n${buildPropertyTable(props)}\n\n---\n\n`;
  fs.writeFileSync(entryFilePath, entryContent, "utf-8");

  // 4. Insert ordered-list link in database index.md
  const rawLink = `[${entryTitle}](${relativePath})`;
  if (hostEditor.isActiveEditorDocumentEqualTo(document)) {
    await insertDbEntryLinkWithListModel(document, position, rawLink, fromSlashCommand);
    await hostEditor.saveActiveDocument();
  } else {
    // Non-active docs (webview / command palette): append as ordered list item.
    appendDbEntryLinkToFile(document, rawLink);
  }

  // 5. Open the entry page
  const entryDoc = await hostEditor.openTextDocument(entryFilePath);
  await hostEditor.showTextDocument(entryDoc);

  hostEditor.showInformation(`Entry "${entryTitle}" created.`);
}

async function insertDbEntryLinkWithListModel(
  document: TextDocument,
  position: Position,
  rawLink: string,
  fromSlashCommand: boolean,
): Promise<void> {
  const lineNumber = Math.min(position.line, document.lineCount - 1);
  const line = document.lineAt(lineNumber);
  const lineText = line.text;
  const cursorCol = Math.min(position.character, lineText.length);
  let insertedLine = lineNumber;

  if (fromSlashCommand) {
    const slashIdx = lineText.lastIndexOf("/", Math.max(cursorCol - 1, 0));
    if (slashIdx !== -1) {
      const before = lineText.slice(0, slashIdx);
      const after = lineText.slice(slashIdx + 1);

      const orderedOnly = before.match(Regex.orderedListMarkerOnly);

      if (orderedOnly) {
        const replacement = `${orderedOnly[1]}${orderedOnly[2]}${orderedOnly[3]}${rawLink}${after}`;
        await hostEditor.replaceRange(line.range, replacement);
        await renumberOrderedListAtLine(insertedLine);
        return;
      }

      if (before.trim().length === 0) {
        const indent = before.match(Regex.lineIndent)?.[1] ?? "";
        await hostEditor.replaceRange(line.range, `${indent}1. ${rawLink}${after}`);
        await renumberOrderedListAtLine(insertedLine);
        return;
      }

      // Non-empty content line: remove trigger and append a new ordered entry line below.
      await hostEditor.replaceRange(
        new Range(new Position(lineNumber, slashIdx), new Position(lineNumber, slashIdx + 1)),
        "",
      );
      const refreshedLine = hostEditor.getLine(lineNumber);
      const orderedWithContent = refreshedLine.text.match(Regex.orderedListWithContent);
      const indent = orderedWithContent?.[1] ?? refreshedLine.text.match(Regex.lineIndent)?.[1] ?? "";
      const sep = orderedWithContent?.[3] ?? ". ";
      await hostEditor.insertAt(refreshedLine.range.end, `\n${indent}1${sep}${rawLink}`);
      insertedLine = lineNumber + 1;
      await renumberOrderedListAtLine(insertedLine);
      return;
    }
  }

  const orderedOnly = lineText.match(Regex.orderedListMarkerOnly);

  if (orderedOnly || lineText.trim().length === 0) {
    const indent = orderedOnly?.[1] ?? lineText.match(Regex.lineIndent)?.[1] ?? "";
    await hostEditor.replaceRange(line.range, `${indent}1. ${rawLink}`);
    await renumberOrderedListAtLine(insertedLine);
    return;
  }

  // Insert as a new ordered item below current line, then renumber using list model.
  const orderedWithContent = lineText.match(Regex.orderedListWithContent);
  const indent = orderedWithContent?.[1] ?? "";
  const sep = orderedWithContent?.[3] ?? ". ";
  await hostEditor.insertAt(line.range.end, `\n${indent}1${sep}${rawLink}`);
  insertedLine = lineNumber + 1;
  await renumberOrderedListAtLine(insertedLine);
}

async function renumberOrderedListAtLine(line: number): Promise<void> {
  const doc = hostEditor.getDocument();
  if (!doc || line < 0 || line >= doc.lineCount) {
    return;
  }

  const items = collectOrderedList(doc, line);
  if (items.length === 0) {
    return;
  }

  const edits = renumberEdits(doc, items, 0, 1);
  await applyRenumberEdits(edits);
}

function appendDbEntryLinkToFile(document: TextDocument, rawLink: string): void {
  const existing = document.getText();
  const topLevelOrdered = collectLastTopLevelOrderedList(document);
  const nextNum = topLevelOrdered.length > 0 ? topLevelOrdered[topLevelOrdered.length - 1].num + 1 : 1;
  const suffix = existing.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(document.uri.fsPath, `${existing}${suffix}${nextNum}. ${rawLink}\n`, "utf-8");
}

function collectLastTopLevelOrderedList(document: TextDocument): ListNode[] {
  let best: ListNode[] = [];
  let bestEndLine = -1;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    const m = line.match(Regex.orderedListItem);
    if (!m || m[1].length !== 0) {
      continue;
    }

    const items = collectOrderedList(document, i);
    if (items.length === 0) {
      continue;
    }

    const endLine = items[items.length - 1].line;
    if (endLine > bestEndLine) {
      best = items;
      bestEndLine = endLine;
    }
    i = endLine;
  }

  return best;
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

function getDefaultValueForColumn(col: DbColumn, defaults: Record<string, string>): string | undefined {
  const providedDefault = defaults[col.name];
  if (providedDefault !== undefined) {
    return providedDefault;
  }
  // Schema-level `default:` wins over the type-fallback so a user who
  // declares `default: 2026-01-01` doesn't get overridden by today's date.
  if (col.default !== undefined && col.default !== "") {
    return col.default;
  }
  if (col.type === "date") {
    const today = new Date().toISOString().slice(0, 10);
    return today;
  }
}
