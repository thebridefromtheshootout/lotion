import React, { useRef, useState } from "react";
import { DbColumn, FilterNode, FilterGroup, FilterLeaf, isLeaf } from "../types";
import { pruneEmptyGroups } from "../utils/filterSort";
import type { DbFilterOperator } from "../../contracts/databaseTypes";
import { ColumnNameOptions } from "./ColumnNameOptions";

interface FilterBarProps {
  schema: DbColumn[];
  titleFieldLabel: string;
  filterTree: FilterGroup;
  setFilterTree: (tree: FilterGroup) => void;
}

const OPERATORS = [
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
  const valRef = useRef<HTMLInputElement>(null);

  // ── Staging area: tiles created but not yet placed in the tree ──
  const [stagedTiles, setStagedTiles] = useState<FilterLeaf[]>([]);

  function createFilterTile() {
    const col = colRef.current!.value;
    const op = opRef.current!.value as DbFilterOperator;
    const val = valRef.current!.value.trim();
    if (!val && op !== "isempty" && op !== "isnotempty") return;
    setStagedTiles((prev) => [...prev, { col, op, value: val }]);
    valRef.current!.value = "";
  }

  function removeStagedTile(index: number) {
    setStagedTiles((prev) => prev.filter((_, i) => i !== index));
  }

  function addGroupAtPath(path: number[], logic: "AND" | "OR") {
    const next = deepClone(filterTree);
    const group = getNodeByPath(next, path) as FilterGroup;
    group.clauses.push({ logic, clauses: [] });
    ensureRootAnd(next);
    setFilterTree(next);
  }

  function removeAtPath(path: number[]) {
    if (path.length === 0) return; // never remove root
    const next = deepClone(filterTree);
    const parent = getNodeByPath(next, path.slice(0, -1)) as FilterGroup;
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
    if (isAncestor(fromPath, toGroupPath)) return;
    const next = deepClone(filterTree);
    const node = getNodeByPath(next, fromPath);
    const fromParent = getNodeByPath(next, fromPath.slice(0, -1)) as FilterGroup;
    fromParent.clauses.splice(fromPath[fromPath.length - 1], 1);
    const target = getNodeByPath(next, toGroupPath) as FilterGroup;
    target.clauses.push(node);
    pruneEmptyGroups(next);
    ensureRootAnd(next);
    setFilterTree(next);
  }

  function dropStagedTile(index: number, toGroupPath: number[]) {
    const tile = stagedTiles[index];
    if (!tile) return;
    setStagedTiles((prev) => prev.filter((_, i) => i !== index));
    const next = deepClone(filterTree);
    const target = getNodeByPath(next, toGroupPath) as FilterGroup;
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
    const payload: DragPayloadTree = { source: "tree", path };
    setDragPayload(ev, payload);
  }

  function onDragStartStaged(ev: React.DragEvent, index: number) {
    const payload: DragPayloadStaging = { source: "staging", index };
    setDragPayload(ev, payload);
  }

  function updateGroupAtPath(path: number[], update: (group: FilterGroup) => void, enforceRoot = false) {
    const next = deepClone(filterTree);
    const node = getNodeByPath(next, path);
    if (!isLeaf(node)) {
      update(node);
    }
    if (enforceRoot) {
      ensureRootAnd(next);
    }
    setFilterTree(next);
  }

  function setDragPayload(ev: React.DragEvent, payload: DragPayload) {
    ev.dataTransfer.setData("application/json", JSON.stringify(payload));
    ev.dataTransfer.effectAllowed = "move";
  }

  function addConditionToPath(path: number[]) {
    const col = colRef.current!.value;
    const op = opRef.current!.value as DbFilterOperator;
    const val = valRef.current!.value.trim();
    if (!val && op !== "isempty" && op !== "isnotempty") {
      // Flash the filter bar to indicate the user needs to fill in a value first
      const bar = document.querySelector(".filter-bar");
      if (bar) {
        bar.classList.add("filter-bar-flash");
        setTimeout(() => bar.classList.remove("filter-bar-flash"), 600);
      }
      valRef.current?.focus();
      return;
    }
    const next = deepClone(filterTree);
    const group = getNodeByPath(next, path) as FilterGroup;
    group.clauses.push({ col, op, value: val });
    ensureRootAnd(next);
    valRef.current!.value = "";
    setFilterTree(next);
  }

  return (
    <>
      <div className="filter-bar">
        <div className="filter-bar-inputs">
          <select ref={colRef} id="filterCol">
            <option value="__title">{titleFieldLabel}</option>
            <ColumnNameOptions columns={schema} />
          </select>
          <select ref={opRef} id="filterOp">
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            ref={valRef}
            id="filterVal"
            type="text"
            placeholder="value…"
            onKeyDown={(e) => {
              if (e.key === "Enter") createFilterTile();
            }}
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

// ── Recursive filter tree rendering ─────────────────────────────────

interface FilterTreeViewProps {
  node: FilterNode;
  path: number[];
  titleFieldLabel: string;
  onRemove: (path: number[]) => void;
  onToggleLogic: (path: number[]) => void;
  onToggleNot: (path: number[]) => void;
  onAddCondition: (path: number[]) => void;
  onAddGroup: (path: number[], logic: "AND" | "OR") => void;
  onDropToGroup: (ev: React.DragEvent, path: number[]) => void;
  onDragStart: (ev: React.DragEvent, path: number[]) => void;
}

function FilterTreeView({
  node,
  path,
  titleFieldLabel,
  onRemove,
  onToggleLogic,
  onToggleNot,
  onAddCondition,
  onAddGroup,
  onDropToGroup,
  onDragStart,
}: FilterTreeViewProps): React.JSX.Element | null {
  if (isLeaf(node)) {
    const leaf = node as FilterLeaf;
    return (
      <span className="filter-chip" draggable onDragStart={(e) => onDragStart(e, path)}>
        <FilterChipText leaf={leaf} titleFieldLabel={titleFieldLabel} />
        <span className="remove" onClick={() => onRemove(path)}>
          ×
        </span>
      </span>
    );
  }

  const group = node as FilterGroup;
  const isRoot = path.length === 0;
  const [dragOver, setDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  return (
    <div
      className={`filter-group${isRoot ? " filter-root-group" : ""}${!isRoot ? " filter-group-draggable" : ""}${dragOver ? " filter-group-dragover" : ""}`}
      draggable={!isRoot}
      onDragStart={(e) => {
        if (!isRoot) {
          e.stopPropagation();
          onDragStart(e, path);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        e.stopPropagation();
        dragCounter.current++;
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setDragOver(false);
        }
      }}
      onDrop={(e) => {
        dragCounter.current = 0;
        setDragOver(false);
        onDropToGroup(e, path);
      }}
    >
      <div className="filter-group-header">
        <div className="filter-group-badges">
          {!isRoot && <span className="drag-handle" title="Drag group">⠿</span>}
          <span
            className={`filter-logic${isRoot ? " is-root" : ""}`}
            onClick={() => !isRoot && onToggleLogic(path)}
            title={isRoot ? "Root is always AND" : "Toggle AND/OR"}
          >
            {isRoot ? "AND" : group.logic}
          </span>
          {group.not && (
            <span className="filter-not" onClick={() => onToggleNot(path)}>
              NOT
            </span>
          )}
        </div>
        <div className="filter-group-actions">
          {!isRoot && (
            <button className="icon-btn" onClick={() => onRemove(path)} title="Remove group">
              ×
            </button>
          )}
          <button className="icon-btn" onClick={() => onAddCondition(path)} title="Create filter tile using current field/op/value">
            ＋ Filter here
          </button>
          <button className="icon-btn" onClick={() => onAddGroup(path, "AND")} title="Add AND sub-group">
            ＋ AND
          </button>
          <button className="icon-btn" onClick={() => onAddGroup(path, "OR")} title="Add OR sub-group">
            ＋ OR
          </button>
          <button className="icon-btn" onClick={() => onToggleNot(path)} title="Toggle NOT">
            NOT
          </button>
        </div>
      </div>
      <div className="filter-children">
        {group.clauses.map((c, i) => {
          const childPath = [...path, i];
          return (
            <div key={i} className="filter-node">
              <FilterTreeView
                node={c}
                path={childPath}
                titleFieldLabel={titleFieldLabel}
                onRemove={onRemove}
                onToggleLogic={onToggleLogic}
                onToggleNot={onToggleNot}
                onAddCondition={onAddCondition}
                onAddGroup={onAddGroup}
                onDropToGroup={onDropToGroup}
                onDragStart={onDragStart}
              />
            </div>
          );
        })}
        {group.clauses.length === 0 && <div className="filter-empty">Drop filter tiles here</div>}
      </div>
    </div>
  );
}

function FilterChipText({ leaf, titleFieldLabel }: { leaf: FilterLeaf; titleFieldLabel: string }) {
  return (
    <>
      {leaf.col === "__title" ? titleFieldLabel : leaf.col} <em>{leaf.op || "contains"}</em> {leaf.value}
    </>
  );
}

// ── Deep clone helper ───────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getNodeByPath(root: FilterGroup, path: number[]): FilterNode {
  let node: FilterNode = root;
  for (const idx of path) {
    node = (node as FilterGroup).clauses[idx];
  }
  return node;
}

function isAncestor(ancestor: number[], descendant: number[]): boolean {
  if (ancestor.length >= descendant.length) return false;
  return ancestor.every((v, i) => descendant[i] === v);
}

function ensureRootAnd(tree: FilterGroup) {
  if (tree.logic !== "AND") tree.logic = "AND";
}
