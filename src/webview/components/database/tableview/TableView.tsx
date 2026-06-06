import React, { useState, useCallback, useEffect, useRef } from "react";
import { DbColumn, DbEntryData, TableViewProps, commitEditMethodType } from "../../../types/";
import type { DbPanelToExtensionCommunicator } from "../../../communicators/DbPanelToExtensionCommunicator";
import { InlineEditor } from "./InlineEditor";
import { ColumnValueCell } from "../ColumnValueCell";
import { ColumnWidths, clampWidth, loadColumnWidths, saveColumnWidths } from "../../../utils/colWidths";
import { Icon } from "../../Icon";

interface DragState {
  colName: string;
  startX: number;
  startWidth: number;
}

export function TableView({
  entries,
  schema,
  titleFieldLabel,
  sortCol,
  sortDir,
  onToggleSort,
  onLocalEntryUpdate,
  baseUri,
  dbName,
  communicator,
}: TableViewProps) {
  const [editCell, setEditCell] = useState<{ relPath: string; colName: string } | null>(null);
  const [colWidths, setColWidths] = useState<ColumnWidths>(() => loadColumnWidths(dbName));
  const dragRef = useRef<DragState | null>(null);

  // ── Row selection (bulk-edit) ──
  // `selectedPaths` is keyed by entry.relativePath so the set survives
  // re-sorts / filter changes. `anchorPath` is the most-recently clicked
  // row — shift-click extends the range from it.
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [anchorPath, setAnchorPath] = useState<string | null>(null);

  // Drop selections that no longer match the visible entries (e.g. after a
  // filter change). Keeps the bulk-edit bar honest about its count.
  useEffect(() => {
    setSelectedPaths((prev) => {
      const visible = new Set(entries.map((e) => e.relativePath));
      const next = new Set<string>();
      let changed = false;
      for (const p of prev) {
        if (visible.has(p)) next.add(p);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [entries]);

  const toggleRowSelection = useCallback(
    (relPath: string, shiftKey: boolean) => {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (shiftKey && anchorPath && anchorPath !== relPath) {
          const anchorIdx = entries.findIndex((e) => e.relativePath === anchorPath);
          const targetIdx = entries.findIndex((e) => e.relativePath === relPath);
          if (anchorIdx >= 0 && targetIdx >= 0) {
            const [lo, hi] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
            for (let i = lo; i <= hi; i++) next.add(entries[i].relativePath);
            return next;
          }
        }
        if (next.has(relPath)) next.delete(relPath);
        else next.add(relPath);
        return next;
      });
      setAnchorPath(relPath);
    },
    [entries, anchorPath],
  );

  const toggleAllVisible = useCallback(() => {
    setSelectedPaths((prev) => {
      const allSelected = entries.length > 0 && entries.every((e) => prev.has(e.relativePath));
      return allSelected ? new Set() : new Set(entries.map((e) => e.relativePath));
    });
  }, [entries]);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    setAnchorPath(null);
  }, []);

  // Hydrate again if dbName changes (rare but safe).
  useEffect(() => {
    setColWidths(loadColumnWidths(dbName));
  }, [dbName]);

  const beginResize = useCallback(
    (colName: string, ev: React.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      const headerCell = (ev.currentTarget as HTMLElement).closest("th") as HTMLElement | null;
      const startWidth = colWidths[colName] ?? headerCell?.getBoundingClientRect().width ?? 120;
      dragRef.current = { colName, startX: ev.clientX, startWidth };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [colWidths],
  );

  useEffect(() => {
    function onMouseMove(ev: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = ev.clientX - drag.startX;
      const next = clampWidth(drag.startWidth + delta);
      setColWidths((prev) => (prev[drag.colName] === next ? prev : { ...prev, [drag.colName]: next }));
    }
    function onMouseUp() {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setColWidths((prev) => {
        saveColumnWidths(dbName, prev);
        return prev;
      });
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dbName]);

  const widthStyle = (colName: string): React.CSSProperties | undefined => {
    const w = colWidths[colName];
    return typeof w === "number" ? { width: w, minWidth: w, maxWidth: w } : undefined;
  };

  if (entries.length === 0) {
    return <div className="empty-state">No entries match the active filters.</div>;
  }

  const SortButton = ({ col }: { col: string }) => {
    const active = sortCol === col;
    const iconName = !active ? "arrow-swap" : sortDir === "asc" ? "triangle-up" : "triangle-down";
    const title = !active ? "Sort ascending" : sortDir === "asc" ? "Sort descending" : "Clear sort";
    return (
      <button
        className={`col-sort-btn${active ? " active" : ""}`}
        title={title}
        aria-label={title}
        onClick={(ev) => {
          ev.stopPropagation();
          onToggleSort(col);
        }}
      >
        <Icon name={iconName} />
      </button>
    );
  };

  // Stable identity for commitEdit so React.memo'd rows don't re-render
  // every time the parent re-renders.
  const commitEdit = useCallback(
    (relPath: string, colName: string, newVal: string) => {
      communicator.sendUpdateEntryProperty(relPath, colName, newVal);
      onLocalEntryUpdate(relPath, colName, newVal);
      setEditCell(null);
    },
    [communicator, onLocalEntryUpdate],
  );

  function copyColumn(colName: string) {
    const values =
      colName === "__title" ? entries.map((e) => e.title ?? "") : entries.map((e) => e.properties[colName] ?? "");
    const label = colName === "__title" ? `${titleFieldLabel} column` : `${colName} column`;
    communicator.sendCopyToClipboard(values.join("\n"), label);
  }

  // Apply a single column's value to every selected row. Reuses the same
  // updateEntryProperty message the inline editor uses, so schema
  // validation on the extension side enforces required/range/option
  // constraints uniformly. Optimistic local update keeps the table snappy.
  const applyBulkEdit = useCallback(
    (colName: string, value: string) => {
      for (const relPath of selectedPaths) {
        communicator.sendUpdateEntryProperty(relPath, colName, value);
        onLocalEntryUpdate(relPath, colName, value);
      }
    },
    [selectedPaths, communicator, onLocalEntryUpdate],
  );

  const allVisibleSelected = entries.length > 0 && entries.every((e) => selectedPaths.has(e.relativePath));

  return (
    <div className="table-wrap">
      {selectedPaths.size > 0 && (
        <BulkEditBar
          schema={schema}
          selectionCount={selectedPaths.size}
          onApply={applyBulkEdit}
          onClear={clearSelection}
        />
      )}
      <table className="db-table">
        <colgroup>
          <col style={{ width: 32 }} />
          <col style={widthStyle("__title")} />
          {schema.map((c) => (
            <col key={c.name} style={widthStyle(c.name)} />
          ))}
          <col style={{ width: 60 }} />
        </colgroup>
        <thead>
          <tr>
            <th className="select-cell">
              <input
                type="checkbox"
                aria-label={allVisibleSelected ? "Clear selection" : "Select all visible rows"}
                title={allVisibleSelected ? "Clear selection" : "Select all visible rows"}
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
              />
            </th>
            <th className="resizable-col" style={widthStyle("__title")}>
              <span className="col-header-label">{titleFieldLabel}</span>
              <SortButton col="__title" />
              <button
                className="col-copy-btn"
                title={`Copy values from ${titleFieldLabel} (newline-joined)`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  copyColumn("__title");
                }}
              >
                <Icon name="copy" />
              </button>
              <span
                className="col-resize-handle"
                title="Drag to resize"
                onMouseDown={(ev) => beginResize("__title", ev)}
              />
            </th>
            {schema.map((c) => {
              const isTag = c.type === "select" || c.type === "multi-select";
              return (
                <th key={c.name} className={`resizable-col${isTag ? " tag-cell" : ""}`} style={widthStyle(c.name)}>
                  <span className="col-header-label">{c.name}</span>
                  <SortButton col={c.name} />
                  <button
                    className="col-copy-btn"
                    title={`Copy values from ${c.name} (newline-joined)`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      copyColumn(c.name);
                    }}
                  >
                    <Icon name="copy" />
                  </button>
                  <span
                    className="col-resize-handle"
                    title="Drag to resize"
                    onMouseDown={(ev) => beginResize(c.name, ev)}
                  />
                </th>
              );
            })}
            <th style={{ width: 60 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <EntryRow
              key={e.relativePath}
              entry={e}
              communicator={communicator}
              schema={schema}
              editingColName={editCell?.relPath === e.relativePath ? editCell.colName : null}
              commitEdit={commitEdit}
              setEditCell={setEditCell}
              baseUri={baseUri}
              selected={selectedPaths.has(e.relativePath)}
              onToggleSelect={toggleRowSelection}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// React.memo'd so rows whose props are shallow-equal don't re-render on
// every keystroke. `editingColName` is null for non-editing rows, so
// editing one cell only re-renders that row.

interface EntryRowProps {
  entry: DbEntryData;
  communicator: DbPanelToExtensionCommunicator;
  schema: DbColumn[];
  /** Column name being edited in this row, or null if no cell in this row is being edited. */
  editingColName: string | null;
  commitEdit: commitEditMethodType;
  setEditCell: React.Dispatch<React.SetStateAction<{ relPath: string; colName: string } | null>>;
  baseUri: string;
  selected: boolean;
  onToggleSelect: (relPath: string, shiftKey: boolean) => void;
}

const EntryRow = React.memo(function EntryRow({
  entry,
  communicator,
  schema,
  editingColName,
  commitEdit,
  setEditCell,
  baseUri,
  selected,
  onToggleSelect,
}: EntryRowProps) {
  return (
    <tr className={selected ? "row-selected" : undefined}>
      <td className="select-cell">
        <input
          type="checkbox"
          aria-label={selected ? "Deselect row" : "Select row"}
          checked={selected}
          onChange={() => {
            /* mouse handler does the work — onChange just keeps React happy */
          }}
          onClick={(ev) => {
            ev.stopPropagation();
            onToggleSelect(entry.relativePath, ev.shiftKey);
          }}
        />
      </td>
      <td className="title-cell">
        <a
          href="#"
          onClick={(ev) => {
            ev.preventDefault();
            communicator.sendOpenEntry(entry.relativePath);
          }}
        >
          {entry.title}
        </a>
      </td>
      {schema.map((c) => {
        const val = entry.properties[c.name] || "";
        const isEditing = editingColName === c.name;
        return (
          <EntryCell
            key={c.name}
            column={c}
            isEditing={isEditing}
            commitEdit={commitEdit}
            entry={entry}
            val={val}
            setEditCell={setEditCell}
            baseUri={baseUri}
          />
        );
      })}
      <td>
        <button
          className="log-btn"
          title="Log current values and clear fields"
          onClick={() => communicator.sendLogEntry(entry.relativePath)}
        >
          <Icon name="output" /> Log
        </button>
      </td>
    </tr>
  );
});

interface EntryCellProps {
  column: DbColumn;
  isEditing: boolean;
  commitEdit: commitEditMethodType;
  entry: DbEntryData;
  val: string;
  setEditCell: React.Dispatch<React.SetStateAction<{ relPath: string; colName: string } | null>>;
  baseUri: string;
}

const EntryCell = React.memo(function EntryCell({
  column,
  isEditing,
  commitEdit,
  entry,
  val,
  setEditCell,
  baseUri,
}: EntryCellProps) {
  const isTagCell = column.type === "select" || column.type === "multi-select";
  return (
    <td
      className={`editable-cell${isTagCell ? " tag-cell" : ""}`}
      onClick={() => {
        if (isEditing) return;
        if (column.type === "checkbox") {
          commitEdit(entry.relativePath, column.name, val === "true" ? "false" : "true");
          return;
        }
        setEditCell({ relPath: entry.relativePath, colName: column.name });
      }}
    >
      {isEditing ? (
        <InlineEditor
          colType={column.type}
          currentVal={val}
          options={column.options || []}
          onCommit={(v) => commitEdit(entry.relativePath, column.name, v)}
          onCancel={() => setEditCell(null)}
        />
      ) : (
        <ColumnValueCell column={column} value={val} baseUri={baseUri} />
      )}
    </td>
  );
});

// ── Bulk-edit bar ──────────────────────────────────────────────────
//
// Floats above the table whenever any rows are selected. The user picks
// a column from the schema, types/selects a value, and "Apply" pushes
// the same value into every selected row via the existing
// updateEntryProperty message. Validation on the extension side
// continues to enforce required / range / option / uniqueness
// constraints per row — invalid edits are rejected per-row with a
// warning, the rest commit normally.

interface BulkEditBarProps {
  schema: DbColumn[];
  selectionCount: number;
  onApply: (colName: string, value: string) => void;
  onClear: () => void;
}

function BulkEditBar({ schema, selectionCount, onApply, onClear }: BulkEditBarProps) {
  const [colName, setColName] = useState<string>(schema[0]?.name ?? "");
  const [value, setValue] = useState<string>("");

  const col = schema.find((c) => c.name === colName);

  const handleApply = useCallback(() => {
    if (!col) return;
    onApply(col.name, value);
    setValue("");
  }, [col, value, onApply]);

  return (
    <div className="bulk-edit-bar">
      <span className="bulk-edit-count">
        {selectionCount} row{selectionCount === 1 ? "" : "s"} selected
      </span>
      <label className="bulk-edit-label">
        Set
        <select value={colName} onChange={(ev) => setColName(ev.target.value)}>
          {schema.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="bulk-edit-label">
        to
        {col?.type === "select" && col.options && col.options.length > 0 ? (
          <select value={value} onChange={(ev) => setValue(ev.target.value)}>
            <option value="">—</option>
            {col.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : col?.type === "checkbox" ? (
          <select value={value} onChange={(ev) => setValue(ev.target.value)}>
            <option value="">—</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type={col?.type === "date" ? "date" : col?.type === "number" ? "number" : "text"}
            value={value}
            onChange={(ev) => setValue(ev.target.value)}
            placeholder={col?.type === "multi-select" ? "comma-separated" : ""}
          />
        )}
      </label>
      <button
        onClick={handleApply}
        disabled={!col}
        title={`Apply to ${selectionCount} row${selectionCount === 1 ? "" : "s"}`}
      >
        <Icon name="check" /> Apply
      </button>
      <button onClick={onClear} title="Clear selection">
        <Icon name="close" /> Clear
      </button>
    </div>
  );
}
