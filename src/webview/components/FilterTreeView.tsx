import React from "react";
import { DbFilterClause, DbFilterGroup, DbViewFilter, isFilterLeaf } from "../types";
import { Draggable } from "./Draggable";

// ── Recursive filter tree rendering ─────────────────────────────────

export interface FilterTreeViewProps {
  node: DbFilterClause;
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

export function FilterTreeView({
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
  // Hooks must run unconditionally even though they're only consumed
  // by the group branch — chips ignore them.
  const [dragOver, setDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  if (isFilterLeaf(node)) {
    // A chip is a drag *source* only — never a drop target, and never
    // styled with the group's dashed border / padding.
    return (
      <Draggable enabled={!isRoot} onDragStart={(e) => onDragStart(e, path)}>
        <span className="filter-chip">
          <FilterChipText leaf={node} titleFieldLabel={titleFieldLabel} />
          <span className="remove" onClick={() => onRemove(path)}>
            ×
          </span>
        </span>
      </Draggable>
    );
  }

  return (
    <Draggable
      enabled={!isRoot}
      onDragStart={(e) => onDragStart(e, path)}
      className={`filter-group${isRoot ? " filter-root-group" : ""}${!isRoot ? " filter-group-draggable" : ""}${dragOver ? " filter-group-dragover" : ""}`}
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
      <FilterGroupBody
        group={node}
        path={path}
        isRoot={isRoot}
        titleFieldLabel={titleFieldLabel}
        onRemove={onRemove}
        onToggleLogic={onToggleLogic}
        onToggleNot={onToggleNot}
        onAddCondition={onAddCondition}
        onAddGroup={onAddGroup}
        onDropToGroup={onDropToGroup}
        onDragStart={onDragStart}
      />
    </Draggable>
  );
}

interface FilterGroupBodyProps extends Omit<FilterTreeViewProps, "node"> {
  group: DbFilterGroup;
  isRoot: boolean;
}

function FilterGroupBody({
  group,
  path,
  isRoot,
  titleFieldLabel,
  onRemove,
  onToggleLogic,
  onToggleNot,
  onAddCondition,
  onAddGroup,
  onDropToGroup,
  onDragStart,
}: FilterGroupBodyProps) {
  return (
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
  );
}

export function FilterChipText({ leaf, titleFieldLabel }: { leaf: DbViewFilter; titleFieldLabel: string }) {
  return (
    <>
      {leaf.col === "__title" ? titleFieldLabel : leaf.col} <em>{leaf.op || "contains"}</em> {leaf.value}
    </>
  );
}
