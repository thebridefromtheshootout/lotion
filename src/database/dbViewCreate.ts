import { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { DbFilterOperator, DbView, DbViewFilter, parseViewsFromFile, saveViewsToFile } from "./dbViews";
import { parseSchemaOrShowError } from "./dbSchemaEdits";

// ── /new-view handler ──────────────────────────────────────────────

/**
 * Prompts for sort column, sort direction, filter settings, and view name,
 * then saves a new DbView into the lotion-db-views block.
 */
export async function handleNewViewCommand(document: TextDocument, _position: Position): Promise<void> {
  const schema = parseSchemaOrShowError(document);
  if (!schema) {
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
