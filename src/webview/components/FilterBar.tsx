import React, { useRef, useState } from "react";
import { DbColumn, DbFilterGroup, DbViewFilter, isFilterLeaf } from "../types";
import { pruneEmptyGroups } from "../utils/filterSort";
import { getNodeByPath, isAncestor } from "../utils/filterTree";
import type { DbFilterOperator } from "../../contracts/databaseTypes";
import { ColumnNameOptions } from "./ColumnNameOptions";
import { FilterValueInput, inputKindFor } from "./FilterValueInput";
import { FilterTreeView, FilterChipText } from "./FilterTreeView";

interface FilterBarProps {
  schema: DbColumn[];
  titleFieldLabel: string;
  filterTree: DbFilterGroup;
  setFilterTree: (tree: DbFilterGroup) => void;
}

const OPERATORS: { value: DbFilterOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "!contains", label: "!contains" },
  { value: "==", label: "== (equals)" },
  { value: "!=", label: "!= (not equal)" },
  { value: "startswith", label: "startswith" },
  { value: "!startswith", label: "!startswith" },
  { value: "endswith", label: "endswith" },
  { value: "!endswith", label: "!endswith" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "between", label: "between" },
  { value: "in", label: "in" },
  { value: "!in", label: "!in" },
  { value: "has_any", label: "has_any" },
  { value: "has_all", label: "has_all" },
  { value: "matches_regex", label: "matches_regex" },
  { value: "isempty", label: "isempty" },
  { value: "isnotempty", label: "isnotempty" },
];

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
  const valueKind = inputKindFor(currentColumn?.type, selectedOp);

  // ── Staging area: tiles created but not yet placed in the tree ──
  const [stagedTiles, setStagedTiles] = useState<DbViewFilter[]>([]);

  function createFilterTile() {
    const nextLeaf = readDbViewFilterInput();
    if (!nextLeaf || !isValidLeafValue(nextLeaf)) {
      return;
    }
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
    if (!nextLeaf || !isValidLeafValue(nextLeaf)) {
      flashFilterBar();
      return;
    }
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
          <select
            ref={colRef}
            id="filterCol"
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
          >
            <option value="__title">{titleFieldLabel}</option>
            <ColumnNameOptions columns={schema} />
          </select>
          <select
            ref={opRef}
            id="filterOp"
            value={selectedOp}
            onChange={(e) => setSelectedOp(e.target.value as DbFilterOperator)}
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FilterValueInput
            kind={valueKind}
            options={currentColumn?.options}
            value={filterValue}
            onChange={setFilterValue}
            onSubmit={createFilterTile}
          />
          <button onClick={createFilterTile}>Create Filter Tile</button>
        </div>
        {stagedTiles.length > 0 && (
          <div className="filter-staging">
            {stagedTiles.map((tile, i) => (
              <span
                key={i}
                className="filter-chip staged"
                draggable
                onDragStart={(e) => onDragStartStaged(e, i)}
              >
                <FilterChipText leaf={tile} titleFieldLabel={titleFieldLabel} />
                <span className="remove" onClick={() => removeStagedTile(i)}>
                  ×
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

function flashFilterBar() {
  const bar = document.querySelector(".filter-bar");
  if (bar) {
    bar.classList.add("filter-bar-flash");
    setTimeout(() => bar.classList.remove("filter-bar-flash"), 600);
  }
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
