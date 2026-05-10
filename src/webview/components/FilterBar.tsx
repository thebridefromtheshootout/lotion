import React, { useRef, useState } from "react";
import { DbColumn, FilterNode, FilterGroup, FilterLeaf, isLeaf } from "../types";
import { pruneEmptyGroups } from "../utils/filterSort";
import { adjustPathAfterRemoval, getNodeByPath, isAncestor } from "../utils/filterTree";
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

  const [selectedCol, setSelectedCol] = useState<string>("__title");
  const [selectedOp, setSelectedOp] = useState<DbFilterOperator>("contains");
  const [filterValue, setFilterValue] = useState<string>("");

  const currentColumn = schema.find((c) => c.name === selectedCol);
  const valueKind = inputKindFor(currentColumn?.type, selectedOp);

  // ── Staging area: tiles created but not yet placed in the tree ──
  const [stagedTiles, setStagedTiles] = useState<FilterLeaf[]>([]);

  function createFilterTile() {
    const nextLeaf = readFilterLeafInput();
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
  function printTree(node: FilterNode, indent=0) {
    let prefix = '';
    for(let i=0;i<indent;i+=1){
      prefix += ' '; 
    }
    if (isLeaf(node)) {
      console.debug(prefix +`${node.col} ${node.op} ${node.value}`)
    }
    else {
      console.debug(prefix + `${node.not?'!':''} ${node.logic} (`)
      for(const child of node.clauses) {
        printTree(child,indent+1)
      }
      console.debug(prefix + ')')
    }
  }
  function moveTreeNode(fromPath: number[], toGroupPath: number[]) {
    // Don't allow dropping a group into one of its own descendants.
    console.debug("from: ", fromPath)
    console.debug("to: ", toGroupPath)
    if (isAncestor(fromPath, toGroupPath)) return;
    const next = deepClone(filterTree);
    console.debug('next: ')
    printTree(next, 0)
    const node = getNodeByPath(next, fromPath);
    console.debug('node: ')
    printTree(node, 0)
    const fromParent = getNodeByPath(next, fromPath.slice(0, -1)) as FilterGroup;
    console.debug('fromParent: ')
    printTree(fromParent, 0)
    const target = getNodeByPath(next, toGroupPath) as FilterGroup;
    console.debug('target: ')
    printTree(target, 0)
    target.clauses.push(node);
    console.debug('target (post insertion): ')
    printTree(target, 0)
    const nodeIndex = fromParent.clauses.indexOf(node);
    fromParent.clauses.splice(nodeIndex, 1);
    console.debug('fromParent (post removal): ')
    printTree(fromParent, 0)
    // After the splice, indices of later siblings (and any path that
    // traverses one of them) shift down by one. Re-target accordingly.
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
    console.debug('dropped')
    const payload: DragPayload = JSON.parse(raw);
    if (payload.source === "staging") {
      console.debug("staging")
      dropStagedTile(payload.index, targetPath);
    } else if (payload.source === "tree") {
      console.debug("tree")
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
    const nextLeaf = readFilterLeafInput();
    if (!nextLeaf || !isValidLeafValue(nextLeaf)) {
      flashFilterBar();
      valRef.current?.focus();
      return;
    }
    const next = deepClone(filterTree);
    const group = getNodeByPath(next, path) as FilterGroup;
    group.clauses.push(nextLeaf);
    ensureRootAnd(next);
    clearValueInput();
    setFilterTree(next);
  }

  function clearValueInput() {
    setFilterValue("");
  }

  function readFilterLeafInput(): FilterLeaf | null {
    if (!colRef.current || !opRef.current) {
      return null;
    }
    return {
      col: colRef.current.value,
      op: opRef.current.value as DbFilterOperator,
      value: filterValue.trim(),
    };
  }

  function isValidLeafValue(leaf: FilterLeaf): boolean {
    return leaf.value.length > 0 || leaf.op === "isempty" || leaf.op === "isnotempty";
  }

  function flashFilterBar() {
    // Flash the filter bar to indicate the user needs to fill in a value first
    const bar = document.querySelector(".filter-bar");
    if (bar) {
      bar.classList.add("filter-bar-flash");
      setTimeout(() => bar.classList.remove("filter-bar-flash"), 600);
    }
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

// ── Type-aware value input ─────────────────────────────────────────

type ValueInputKind = "text" | "number" | "date" | "url" | "boolean" | "select" | "multi-select" | "none";

function inputKindFor(type: DbColumn["type"] | undefined, op: DbFilterOperator): ValueInputKind {
  if (op === "isempty" || op === "isnotempty") {
    return "none";
  }
  // Regex / between are always free-form text regardless of column type.
  if (op === "matches_regex" || op === "between") {
    return "text";
  }
  // `in` / `!in` accept a comma-separated list. For column types where we
  // know the option set (select / multi-select), still let the user check
  // multiple options to build that list.
  switch (type) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "checkbox":
      return "boolean";
    case "url":
      return "url";
    case "select":
      // For has_any / has_all / in / !in on a single-select column, fall
      // back to a checkbox list so the user can pick multiple options.
      if (op === "has_any" || op === "has_all" || op === "in" || op === "!in") {
        return "multi-select";
      }
      return "select";
    case "multi-select":
      return "multi-select";
    default:
      return "text";
  }
}

interface FilterValueInputProps {
  kind: ValueInputKind;
  options: string[] | undefined;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

function FilterValueInput({ kind, options, value, onChange, onSubmit }: FilterValueInputProps) {
  if (kind === "none") {
    return (
      <input
        id="filterVal"
        type="text"
        placeholder="(no value)"
        value=""
        disabled
        readOnly
      />
    );
  }
  if (kind === "boolean") {
    // True/false columns get an actual checkbox + a label so the picked
    // value is unambiguous. Click toggles between "true" and "false".
    const checked = value === "true";
    return (
      <label id="filterVal" className="filter-checkbox-value" title="Filter value">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        <span>{checked ? "true" : "false"}</span>
      </label>
    );
  }
  if (kind === "select") {
    return (
      <select id="filterVal" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "multi-select") {
    const selected = new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    function toggle(opt: string, checked: boolean) {
      const next = new Set(selected);
      if (checked) next.add(opt);
      else next.delete(opt);
      onChange(Array.from(next).join(", "));
    }
    return (
      <div id="filterVal" className="filter-multi-select" role="group">
        {(options ?? []).length === 0 ? (
          <span className="filter-empty-options">no options defined</span>
        ) : (
          (options ?? []).map((o) => (
            <label key={o} className="filter-multi-select-option">
              <input
                type="checkbox"
                checked={selected.has(o)}
                onChange={(e) => toggle(o, e.target.checked)}
              />
              <span>{o}</span>
            </label>
          ))
        )}
      </div>
    );
  }
  return (
    <input
      id="filterVal"
      type={kind}
      placeholder="value…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit();
      }}
    />
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
  

  const isRoot = path.length === 0;
  const [dragOver, setDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);
  const group = node as FilterGroup;

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
      {isLeaf(node) ?
      <span className="filter-chip" draggable onDragStart={(e) => onDragStart(e, path)}>
        <FilterChipText leaf={node} titleFieldLabel={titleFieldLabel} />
        <span className="remove" onClick={() => onRemove(path)}>
          ×
        </span>
      </span>
      :
        <>
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
        </>
      }
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
  // structuredClone (Node 17+, all modern browsers / vscode webviews) is
  // ~3× faster than the JSON.parse(JSON.stringify(...)) round-trip and
  // doesn't need to round-trip through a string.
  return structuredClone(obj);
}

function ensureRootAnd(tree: FilterGroup) {
  if (tree.logic !== "AND") tree.logic = "AND";
}
