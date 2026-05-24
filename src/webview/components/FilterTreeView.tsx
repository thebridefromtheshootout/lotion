import React from "react";
import { DbFilterClause, DbFilterGroup, DbViewFilter, isFilterLeaf } from "../types";
import { Draggable } from "./Draggable";
import { Icon } from "./Icon";

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
        <span className={`filter-chip${node.not ? " filter-chip-negated" : ""}`}>
          <FilterChipText leaf={node} titleFieldLabel={titleFieldLabel} />
          <button
            type="button"
            className={`filter-chip-not${node.not ? " active" : ""}`}
            onClick={() => onToggleNot(path)}
            title={node.not ? "Filter is negated — click to un-negate" : "Negate this filter"}
            aria-pressed={node.not || false}
          >
            NOT
          </button>
          <span className="remove" onClick={() => onRemove(path)} aria-label="Remove filter">
            <Icon name="close" />
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
          {!isRoot && (
            <span className="drag-handle" title="Drag group">
              <Icon name="grabber" />
            </span>
          )}
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
            <button className="icon-btn" onClick={() => onRemove(path)} title="Remove group" aria-label="Remove group">
              <Icon name="close" />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => onAddCondition(path)}
            title="Create filter tile using current field/op/value"
          >
            <Icon name="add" /> Filter here
          </button>
          <button className="icon-btn" onClick={() => onAddGroup(path, "AND")} title="Add AND sub-group">
            <Icon name="add" /> AND
          </button>
          <button className="icon-btn" onClick={() => onAddGroup(path, "OR")} title="Add OR sub-group">
            <Icon name="add" /> OR
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
      {leaf.caseSensitive ? (
        <span className="filter-chip-case" title="Case-sensitive">
          Aa
        </span>
      ) : null}
    </>
  );
}

/**
 * For legacy in-memory filters that still carry a `!X` operator (rather
 * than the affirmative op + `not` flag), surface them as their affirmative
 * equivalent so chip rendering and the operator dropdown converge on one
 * shape. The runtime in `filterSort` understands both forms.
 */
export const LEGACY_NEGATION_MAP: Record<string, string> = {
  "!=": "==",
  "!contains": "contains",
  "!startswith": "startswith",
  "!endswith": "endswith",
  "!in": "in",
};
