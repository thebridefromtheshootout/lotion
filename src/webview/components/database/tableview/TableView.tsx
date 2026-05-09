import React, { useState, useCallback, useEffect, useRef } from "react";
import { DbColumn, DbEntryData, TableViewProps, commitEditMethodType } from "../../../types/";
import type { DbPanelToExtensionCommunicator } from "../../../communicators/DbPanelToExtensionCommunicator";
import { InlineEditor } from "./InlineEditor";
import { ColumnValueCell } from "../ColumnValueCell";
import { ColumnWidths, clampWidth, loadColumnWidths, saveColumnWidths } from "../../../utils/colWidths";

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
  baseUri,
  dbName,
  communicator,
}: TableViewProps) {
  const [editCell, setEditCell] = useState<{ relPath: string; colName: string } | null>(null);
  const [colWidths, setColWidths] = useState<ColumnWidths>(() => loadColumnWidths(dbName));
  const dragRef = useRef<DragState | null>(null);

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

  const arrow = (col: string) => {
    if (sortCol !== col) return null;
    return <span className="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  function commitEdit(relPath: string, colName: string, newVal: string) {
    communicator.sendUpdateEntryProperty(relPath, colName, newVal);
    // optimistic update
    const entry = entries.find((e) => e.relativePath === relPath);
    if (entry) entry.properties[colName] = newVal;
    setEditCell(null);
  }

  function copyColumn(colName: string) {
    const values =
      colName === "__title"
        ? entries.map((e) => e.title ?? "")
        : entries.map((e) => e.properties[colName] ?? "");
    const label = colName === "__title" ? `${titleFieldLabel} column` : `${colName} column`;
    communicator.sendCopyToClipboard(values.join("\n"), label);
  }

  return (
    <div className="table-wrap">
      <table className="db-table">
        <colgroup>
          <col style={widthStyle("__title")} />
          {schema.map((c) => (
            <col key={c.name} style={widthStyle(c.name)} />
          ))}
          <col style={{ width: 60 }} />
        </colgroup>
        <thead>
          <tr>
            <th
              className="resizable-col"
              style={widthStyle("__title")}
              onClick={() => onToggleSort("__title")}
            >
              <span className="col-header-label">{titleFieldLabel}</span>
              {arrow("__title")}
              <button
                className="col-copy-btn"
                title={`Copy values from ${titleFieldLabel} (newline-joined)`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  copyColumn("__title");
                }}
              >
                📋
              </button>
              <span
                className="col-resize-handle"
                title="Drag to resize"
                onMouseDown={(ev) => beginResize("__title", ev)}
                onClick={(ev) => ev.stopPropagation()}
              />
            </th>
            {schema.map((c) => {
              const isTag = c.type === "select" || c.type === "multi-select";
              return (
                <th
                  key={c.name}
                  className={`resizable-col${isTag ? " tag-cell" : ""}`}
                  style={widthStyle(c.name)}
                  onClick={() => onToggleSort(c.name)}
                >
                  <span className="col-header-label">{c.name}</span>
                  {arrow(c.name)}
                  <button
                    className="col-copy-btn"
                    title={`Copy values from ${c.name} (newline-joined)`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      copyColumn(c.name);
                    }}
                  >
                    📋
                  </button>
                  <span
                    className="col-resize-handle"
                    title="Drag to resize"
                    onMouseDown={(ev) => beginResize(c.name, ev)}
                    onClick={(ev) => ev.stopPropagation()}
                  />
                </th>
              );
            })}
            <th style={{ width: 60 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => RenderEntry(e, communicator, schema, editCell, commitEdit, setEditCell, baseUri))}
        </tbody>
      </table>
    </div>
  );
}

function RenderEntry(
  entry: DbEntryData,
  communicator: DbPanelToExtensionCommunicator,
  schema: DbColumn[],
  editCell: { relPath: string; colName: string } | null,
  commitEdit: commitEditMethodType,
  setEditCell: React.Dispatch<React.SetStateAction<{ relPath: string; colName: string } | null>>,
  baseUri: string,
) {
  return (
    <tr key={entry.relativePath}>
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
        const isEditing = editCell?.relPath === entry.relativePath && editCell?.colName === c.name;
        return RenderCell(c, isEditing, commitEdit, entry, val, setEditCell, baseUri);
      })}
      <td>
        <button
          className="log-btn"
          title="Log current values and clear fields"
          onClick={() => communicator.sendLogEntry(entry.relativePath)}
        >
          📝 Log
        </button>
      </td>
    </tr>
  );
}

function RenderCell(
  c: DbColumn,
  isEditing: boolean,
  commitEdit: commitEditMethodType,
  entry: DbEntryData,
  val: string,
  setEditCell: React.Dispatch<React.SetStateAction<{ relPath: string; colName: string } | null>>,
  baseUri: string,
) {
  const isTagCell = c.type === "select" || c.type === "multi-select";
  return (
    <td
      key={c.name}
      className={`editable-cell${isTagCell ? " tag-cell" : ""}`}
      onClick={() => {
        if (isEditing) return;
        if (c.type === "checkbox") {
          commitEdit(entry.relativePath, c.name, val === "true" ? "false" : "true");
          return;
        }
        setEditCell({ relPath: entry.relativePath, colName: c.name });
      }}
    >
      {isEditing ? (
        <InlineEditor
          colType={c.type}
          currentVal={val}
          options={c.options || []}
          onCommit={(v) => commitEdit(entry.relativePath, c.name, v)}
          onCancel={() => setEditCell(null)}
        />
      ) : (
        <ColumnValueCell column={c} value={val} baseUri={baseUri} />
      )}
    </td>
  );
}
