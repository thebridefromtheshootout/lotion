
import { Position, Range } from "../hostEditor/EditorTypes";
import type { QuickPickItem, TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor, OpType, type EditOp } from "../hostEditor/HostingEditor";

/**
 * Interactive front matter editor.
 *
 * Opens a quick pick menu to add/edit/remove YAML frontmatter
 * fields without needing to manually edit the YAML block.
 */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export interface FMField {
  key: string;
  value: string;
}

export function parseFrontmatter(text: string): { fields: FMField[]; exists: boolean } {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    return { fields: [], exists: false };
  }

  const fields: FMField[] = [];
  const lines = match[1].split("\n");
  for (const line of lines) {
    const kv = line.match(/^([^:]+):\s*(.*)/);
    if (kv) {
      fields.push({ key: kv[1].trim(), value: kv[2].trim() });
    }
  }
  return { fields, exists: true };
}

export function buildFrontmatter(fields: FMField[]): string {
  if (fields.length === 0) {
    return "";
  }
  const lines = fields.map((f) => `${f.key}: ${f.value}`);
  return `---\n${lines.join("\n")}\n---`;
}

export async function editFrontmatter(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;
  const text = hostEditor.getDocumentText();
  const { fields, exists } = parseFrontmatter(text);

  const actions: QuickPickItem[] = [
    { label: "$(add) Add field", description: "Add a new frontmatter field" },
    ...fields.map((f) => ({
      label: `$(pencil) ${f.key}`,
      description: f.value || "(empty)",
      detail: "Click to edit value",
    })),
  ];

  if (fields.length > 0) {
    actions.push({
      label: "$(trash) Remove field",
      description: "Remove a frontmatter field",
    });
  }

  const picked = await hostEditor.showQuickPick(actions, {
    placeHolder: "Edit front matter",
  });

  if (!picked) {
    return;
  }

  if (picked.label.includes("Add field")) {
    const key = await hostEditor.showInputBox({
      prompt: "Field name",
      placeHolder: "e.g., author, tags, status",
    });
    if (!key) {
      return;
    }

    const value = await hostEditor.showInputBox({
      prompt: `Value for "${key}"`,
      placeHolder: "Enter value",
    });
    if (value === undefined) {
      return;
    }

    fields.push({ key, value });
    await applyFrontmatter(doc, text, exists, fields);
  } else if (picked.label.includes("Remove field")) {
    const toRemove = await hostEditor.showQuickPick(
      fields.map((f) => ({ label: f.key, description: f.value })),
      { placeHolder: "Select field to remove" },
    );
    if (!toRemove) {
      return;
    }

    const filtered = fields.filter((f) => f.key !== toRemove.label);
    await applyFrontmatter(doc, text, exists, filtered);
  } else {
    // Edit existing field
    const key = picked.label.replace("$(pencil) ", "");
    const field = fields.find((f) => f.key === key);
    if (!field) {
      return;
    }

    const newValue = await hostEditor.showInputBox({
      prompt: `Edit "${key}"`,
      value: field.value,
    });
    if (newValue === undefined) {
      return;
    }

    field.value = newValue;
    await applyFrontmatter(doc, text, exists, fields);
  }
}

async function applyFrontmatter(
  doc: TextDocument,
  text: string,
  hadFrontmatter: boolean,
  fields: FMField[],
): Promise<void> {
  const newFM = buildFrontmatter(fields);

  let op: EditOp;
  if (hadFrontmatter) {
    const match = FRONTMATTER_RE.exec(text)!;
    const start = doc.positionAt(match.index);
    const end = doc.positionAt(match.index + match[0].length);
    if (newFM) {
      op = { type: OpType.Replace, range: new Range(start, end), text: newFM };
    } else {
      // Remove frontmatter entirely (including trailing newline)
      const deleteEnd =
        match.index + match[0].length < text.length ? doc.positionAt(match.index + match[0].length + 1) : end;
      op = { type: OpType.Delete, range: new Range(start, deleteEnd) };
    }
  } else if (newFM) {
    op = { type: OpType.Insert, position: new Position(0, 0), text: newFM + "\n\n" };
  } else {
    return;
  }
  await hostEditor.batchEdit([op]);
}
