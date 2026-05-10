import { hostEditor } from "../hostEditor/HostingEditor";
import { DbColumn } from "./dbSchema";
import { Regex } from "../core/regex";

// ── Column value prompters ─────────────────────────────────────────

export async function promptForColumnValue(
  col: DbColumn,
  defaultValue?: string,
  purpose: "entry" | "backfill" = "entry",
): Promise<string | undefined> {
  const promptLabel = purpose === "backfill" ? `Backfill default for "${col.name}"` : col.name;

  switch (col.type) {
    case "text":
    case "number":
    case "url":
      return hostEditor
        .showInputBox({
          prompt: `${promptLabel} (${col.type})`,
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
          prompt: `${promptLabel} (YYYY-MM-DD)`,
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
        .showQuickPick([{ label: "true" }, { label: "false" }], { placeHolder: promptLabel })
        .then((v) => v?.label);

    case "select":
      if (col.options && col.options.length > 0) {
        return hostEditor
          .showQuickPick(
            col.options.map((o) => ({ label: o })),
            { placeHolder: promptLabel },
          )
          .then((v) => v?.label);
      }
      return hostEditor.showInputBox({ prompt: promptLabel, value: defaultValue }).then((v) => v ?? undefined);

    case "multi-select":
      if (col.options && col.options.length > 0) {
        const picks = await hostEditor.showQuickPick(
          col.options.map((o) => ({ label: o })),
          { placeHolder: `${promptLabel} (select at least one)`, canPickMany: true },
        );
        if (!picks || picks.length === 0) {
          hostEditor.showWarning(`${col.name} requires at least one selection.`);
          return undefined;
        }
        return picks.map((p) => p.label).join(", ");
      }
      return hostEditor
        .showInputBox({
          prompt: `${promptLabel} (comma-separated)`,
          value: defaultValue,
          validateInput: (v) => (!v || v.trim().length === 0 ? `${col.name} is required` : undefined),
        })
        .then((v) => v ?? undefined);

    case "image":
      return hostEditor
        .showInputBox({
          prompt: `${promptLabel} — path to image in .rsrc (e.g. .rsrc/photo.png)`,
          value: defaultValue,
          placeHolder: ".rsrc/image.png",
        })
        .then((v) => v ?? undefined);

    case "coordinates":
      return hostEditor
        .showInputBox({
          prompt: `${promptLabel} (lat, lng)`,
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

// ── Column-definition prompter (type, options, image dimensions) ────

export interface PromptColumnDefinitionOptions {
  includeImageType?: boolean;
  requireOptionsForSelect?: boolean;
  includeImageDimensions?: boolean;
  typePlaceholder?: string;
}

const BASE_COLUMN_TYPE_PICK_ITEMS: Array<{ label: DbColumn["type"]; description: string }> = [
  { label: "text", description: "Free text" },
  { label: "number", description: "Numeric value" },
  { label: "select", description: "Single choice from options" },
  { label: "multi-select", description: "Multiple choices from options" },
  { label: "date", description: "Date value (YYYY-MM-DD)" },
  { label: "checkbox", description: "True / false" },
  { label: "url", description: "URL / link" },
  { label: "coordinates", description: "Geographic coordinates (lat, lng)" },
];

const IMAGE_TYPE_PICK_ITEM: { label: DbColumn["type"]; description: string } = {
  label: "image",
  description: "Image path (relative to .rsrc)",
};

function columnTypePickItems(includeImageType: boolean): Array<{ label: DbColumn["type"]; description: string }> {
  return includeImageType ? [...BASE_COLUMN_TYPE_PICK_ITEMS, IMAGE_TYPE_PICK_ITEM] : BASE_COLUMN_TYPE_PICK_ITEMS;
}

function parseCommaSeparated(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function promptColumnDefinition(
  name: string,
  options: PromptColumnDefinitionOptions = {},
): Promise<DbColumn | undefined> {
  const includeImageType = options.includeImageType ?? true;
  const requireOptionsForSelect = options.requireOptionsForSelect ?? true;
  const includeImageDimensions = options.includeImageDimensions ?? true;
  const typePlaceholder = options.typePlaceholder ?? `Type for column "${name}"`;

  const typePick = await hostEditor.showQuickPick(
    columnTypePickItems(includeImageType),
    { placeHolder: typePlaceholder },
  );
  if (!typePick) {
    return undefined;
  }

  const col: DbColumn = { name, type: typePick.label as DbColumn["type"] };

  if (col.type === "select" || col.type === "multi-select") {
    const optionsInput = await hostEditor.showInputBox({
      prompt: `Options for "${name}" (comma-separated)`,
      placeHolder: "Option 1, Option 2, Option 3",
      validateInput: requireOptionsForSelect
        ? (v) => (!v || v.trim().length === 0 ? "At least one option is required" : undefined)
        : undefined,
    });
    if (requireOptionsForSelect && !optionsInput) {
      return undefined;
    }
    if (optionsInput) {
      col.options = parseCommaSeparated(optionsInput);
    }
  }

  if (col.type === "image" && includeImageDimensions) {
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

  return col;
}
