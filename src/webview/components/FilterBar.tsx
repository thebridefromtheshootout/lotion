import React, { useRef, useState } from "react";
import { DbColumn, DbFilterGroup, DbViewFilter, isFilterLeaf } from "../types";
import { pruneEmptyGroups } from "../utils/filterSort";
import { getNodeByPath, isAncestor } from "../utils/filterTree";
import { type DbFilterOperator, defaultOperatorFor, validOperatorsFor } from "../../contracts/databaseTypes";
import { ColumnNameOptions } from "./ColumnNameOptions";
import { FilterValueInput, inputKindFor } from "./FilterValueInput";
import { FilterTreeView, FilterChipText } from "./FilterTreeView";
import { Icon } from "./Icon";

interface FilterBarProps {
  schema: DbColumn[];
  titleFieldLabel: string;
  filterTree: DbFilterGroup;
  setFilterTree: (tree: DbFilterGroup) => void;
}

// Labels for the operator dropdown.
//
// Register: numeric / ordering ops stay as symbols (>, ≥, <, ≤) since
// symbols read faster for math. Everything else (set, string, presence,
// equality) uses verbal labels so the dropdown isn't a soup of `!startswith`
// and `has_any`. "==" reads as "equals" in this context, not as a programming
// idiom, and the negated forms use "doesn't / is not" instead of `!`-prefix.
const OPERATOR_LABELS: Record<DbFilterOperator, string> = {
  contains: "contains",
  "!contains": "doesn't contain",
  "==": "equals",
  "!=": "doesn't equal",
  startswith: "starts with",
  "!startswith": "doesn't start with",
  endswith: "ends with",
  "!endswith": "doesn't end with",
  ">": ">",
  ">=": "≥",
  "<": "<",
  "<=": "≤",
  between: "between",
  in: "is one of",
  "!in": "is not one of",
  has_any: "has any of",
  has_all: "has all of",
  matches_regex: "matches regex",
  isempty: "is empty",
  isnotempty: "is not empty",
};

/** Drag payload transferred via dataTransfer */
interface DragPayloadTree {
  source: "tree";
  path: number[];
}
interface DragPayloadStaging {
  source: "staging";
  index: number;
}
type DragPayload = DragPayloadTree | DragPayloadStaging;

export function FilterBar({ schema, titleFieldLabel, filterTree, setFilterTree }: FilterBarProps) {
  const colRef = useRef<HTMLSelectElement>(null);
  const opRef = useRef<HTMLSelectElement>(null);

  const [selectedCol, setSelectedCol] = useState<string>("__title");
  const [selectedOp, setSelectedOp] = useState<DbFilterOperator>("contains");
  const [filterValue, setFilterValue] = useState<string>("");

  const currentColumn = schema.find((c) => c.name === selectedCol);
  // __title is the implicit string "title" column — treat as text for operator validity.
  const currentColumnType = currentColumn?.type ?? "text";
  const availableOps = validOperatorsFor(currentColumnType);
  const valueKind = inputKindFor(currentColumn?.type, selectedOp);

  // If the user switches column to a type that doesn't support the currently
  // selected operator, snap to the type's default. Without this, the bar
  // would render an op that's no longer in the dropdown.
  function handleColumnChange(nextCol: string) {
    setSelectedCol(nextCol);
    const nextColumn = schema.find((c) => c.name === nextCol);
    const nextType = nextColumn?.type ?? "text";
    if (!validOperatorsFor(nextType).includes(selectedOp)) {
      setSelectedOp(defaultOperatorFor(nextType));
    }
  }

  // ── Staging area: tiles created but not yet placed in the tree ──
  const [stagedTiles, setStagedTiles] = useState<DbViewFilter[]>([]);

  // Inline error shown beneath the bar when submit fails (empty value,
  // bad regex, etc.) — replaces the old 600ms full-bar red flash, which
  // didn't tell the user *what* was wrong.
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validateForSubmit(leaf: DbViewFilter | null): string | null {
    if (!leaf) return "Filter bar not ready.";
    if (leaf.op === "matches_regex") {
      try {
        new RegExp(leaf.value);
      } catch (err) {
        return `Invalid regex: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    if (!isValidLeafValue(leaf)) return "Value is required for this operator.";
    return null;
  }

  function createFilterTile() {
    const nextLeaf = readDbViewFilterInput();
    const error = validateForSubmit(nextLeaf);
    if (error || !nextLeaf) {
      setSubmitError(error ?? "Filter bar not ready.");
      return;
    }
    setSubmitError(null);
    setStagedTiles((prev) => [...prev, nextLeaf]);
    clearValueInput();
  }

  function removeStagedTile(index: number) {
    setStagedTiles((prev) => prev.filter((_, i) => i !== index));
  }

  function addGroupAtPath(path: number[], logic: "AND" | "OR") {
    const next = deepClone(filterTree);
    const group = getNodeByPath(next, path) as DbFilterGroup;
    group.clauses.push({ logic, clauses: [] });
    ensureRootAnd(next);
    setFilterTree(next);
  }

  function removeAtPath(path: number[]) {
    if (path.length === 0) return; // never remove root
    const next = deepClone(filterTree);
    const parent = getNodeByPath(next, path.slice(0, -1)) as DbFilterGroup;
    parent.clauses.splice(path[path.length - 1], 1);
    pruneEmptyGroups(next);
    ensureRootAnd(next);
    setFilterTree(next);
  }

  function toggleLogic(path: number[]) {
    if (path.length === 0) return; // root stays AND
    updateGroupAtPath(path, (group) => {
      group.logic = group.logic === "AND" ? "OR" : "AND";
    });
  }

  function toggleNot(path: number[]) {
    updateGroupAtPath(
      path,
      (group) => {
        group.not = !group.not;
      },
      true,
    );
  }

  function moveTreeNode(fromPath: number[], toGroupPath: number[]) {
    // Don't allow dropping a group into one of its own descendants.
    if (isAncestor(fromPath, toGroupPath)) return;
    const next = deepClone(filterTree);
    const node = getNodeByPath(next, fromPath);
    const fromParent = getNodeByPath(next, fromPath.slice(0, -1)) as DbFilterGroup;
    const target = getNodeByPath(next, toGroupPath) as DbFilterGroup;
    // Insert into target first, then remove from source by reference. This
    // sidesteps index-shift bugs when the source and target share an ancestor.
    target.clauses.push(node);
    fromParent.clauses.splice(fromParent.clauses.indexOf(node), 1);
    pruneEmptyGroups(next);
    ensureRootAnd(next);
    setFilterTree(next);
  }

  function dropStagedTile(index: number, toGroupPath: number[]) {
    const tile = stagedTiles[index];
    if (!tile) return;
    setStagedTiles((prev) => prev.filter((_, i) => i !== index));
    const next = deepClone(filterTree);
    const target = getNodeByPath(next, toGroupPath) as DbFilterGroup;
    target.clauses.push({ ...tile });
    ensureRootAnd(next);
    setFilterTree(next);
  }

  function onDropToGroup(ev: React.DragEvent, targetPath: number[]) {
    ev.preventDefault();
    ev.stopPropagation();
    const raw = ev.dataTransfer.getData("application/json");
    if (!raw) return;
    const payload: DragPayload = JSON.parse(raw);
    if (payload.source === "staging") {
      dropStagedTile(payload.index, targetPath);
    } else if (payload.source === "tree") {
      moveTreeNode(payload.path, targetPath);
    }
  }

  function onDragStartTree(ev: React.DragEvent, path: number[]) {
    setDragPayload(ev, { source: "tree", path });
  }

  function onDragStartStaged(ev: React.DragEvent, index: number) {
    setDragPayload(ev, { source: "staging", index });
  }

  function updateGroupAtPath(path: number[], update: (group: DbFilterGroup) => void, enforceRoot = false) {
    const next = deepClone(filterTree);
    const node = getNodeByPath(next, path);
    if (!isFilterLeaf(node)) {
      update(node);
    }
    if (enforceRoot) {
      ensureRootAnd(next);
    }
    setFilterTree(next);
  }

  function addConditionToPath(path: number[]) {
    const nextLeaf = readDbViewFilterInput();
    const error = validateForSubmit(nextLeaf);
    if (error || !nextLeaf) {
      setSubmitError(error ?? "Filter bar not ready.");
      return;
    }
    setSubmitError(null);
    const next = deepClone(filterTree);
    const group = getNodeByPath(next, path) as DbFilterGroup;
    group.clauses.push(nextLeaf);
    ensureRootAnd(next);
    clearValueInput();
    setFilterTree(next);
  }

  function clearValueInput() {
    setFilterValue("");
  }

  // Add tile leaves the column + operator selected on purpose so the user can
  // build several conditions on the same column quickly. `resetBar` is the
  // escape hatch — wipes the picker back to its defaults.
  function resetBar() {
    setSelectedCol("__title");
    setSelectedOp(defaultOperatorFor("text"));
    setFilterValue("");
    setSubmitError(null);
  }

  // Any input change clears the stale error — the user has moved on.
  function handleValueChange(v: string) {
    setFilterValue(v);
    if (submitError) setSubmitError(null);
  }

  function readDbViewFilterInput(): DbViewFilter | null {
    if (!colRef.current || !opRef.current) {
      return null;
    }
    return {
      col: colRef.current.value,
      op: opRef.current.value as DbFilterOperator,
      value: filterValue.trim(),
    };
  }

  return (
    <>
      <div className="filter-bar">
        <div className="filter-bar-inputs">
          <select ref={colRef} id="filterCol" value={selectedCol} onChange={(e) => handleColumnChange(e.target.value)}>
            <option value="__title">
              {titleFieldLabel}
              {/*
               * __title filters by the page's H1 heading, not by any property
               * column. If the user-defined schema has a column literally named
               * the same as titleFieldLabel, the dropdown would have two
               * indistinguishable options. Suffix " (title)" to disambiguate.
               */}
              {schema.some((c) => c.name === titleFieldLabel) ? " (title)" : ""}
            </option>
            <ColumnNameOptions columns={schema} />
          </select>
          <select
            ref={opRef}
            id="filterOp"
            value={selectedOp}
            onChange={(e) => setSelectedOp(e.target.value as DbFilterOperator)}
          >
            {availableOps.map((op) => (
              <option key={op} value={op}>
                {/* Boolean columns read more naturally as "is" than as "equals". */}
                {currentColumnType === "checkbox" && op === "==" ? "is" : OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
          <FilterValueInput
            kind={valueKind}
            op={selectedOp}
            options={currentColumn?.options}
            value={filterValue}
            onChange={handleValueChange}
            onSubmit={createFilterTile}
          />
          <button onClick={createFilterTile} title="Add filter tile to staging (Enter)">
            <Icon name="add" /> Add
          </button>
          <button
            onClick={resetBar}
            title="Reset column, operator, and value to defaults"
            aria-label="Reset filter bar"
          >
            <Icon name="clear-all" />
          </button>
        </div>
        {submitError && (
          <div className="filter-bar-error" role="alert">
            {submitError}
          </div>
        )}
        {stagedTiles.length > 0 && (
          <div className="filter-staging">
            {stagedTiles.map((tile, i) => (
              <span key={i} className="filter-chip staged" draggable onDragStart={(e) => onDragStartStaged(e, i)}>
                <FilterChipText leaf={tile} titleFieldLabel={titleFieldLabel} />
                <span className="remove" onClick={() => removeStagedTile(i)} aria-label="Remove staged filter">
                  <Icon name="close" />
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <details className="filter-tree-collapsible" open>
        <summary>Filter Tree</summary>
        <div className="filter-tree">
          <FilterTreeView
            node={filterTree}
            path={[]}
            titleFieldLabel={titleFieldLabel}
            onRemove={removeAtPath}
            onToggleLogic={toggleLogic}
            onToggleNot={toggleNot}
            onAddCondition={addConditionToPath}
            onAddGroup={addGroupAtPath}
            onDropToGroup={onDropToGroup}
            onDragStart={onDragStartTree}
          />
        </div>
      </details>
    </>
  );
}

function isValidLeafValue(leaf: DbViewFilter): boolean {
  return leaf.value.length > 0 || leaf.op === "isempty" || leaf.op === "isnotempty";
}

function setDragPayload(ev: React.DragEvent, payload: DragPayload) {
  ev.dataTransfer.setData("application/json", JSON.stringify(payload));
  ev.dataTransfer.effectAllowed = "move";
}

// structuredClone (Node 17+, all modern browsers / vscode webviews) is
// ~3× faster than the JSON.parse(JSON.stringify(...)) round-trip and
// doesn't need to round-trip through a string.
function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

function ensureRootAnd(tree: DbFilterGroup) {
  if (tree.logic !== "AND") tree.logic = "AND";
}
