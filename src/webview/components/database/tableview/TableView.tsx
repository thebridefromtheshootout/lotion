import React, { useState, useCallback } from "react";
import { DbColumn, DbEntryData, TableViewProps, commitEditMethodType } from "../../../types/";
import type { DbPanelToExtensionCommunicator } from "../../../communicators/DbPanelToExtensionCommunicator";
import { InlineEditor } from "./InlineEditor";
import { ColumnValueCell } from "../ColumnValueCell";

export function TableView({
  entries,
  schema,
  titleFieldLabel,
  sortCol,
  sortDir,
  onToggleSort,
  baseUri,
  communicator,
}: TableViewProps) {
  const [editCell, setEditCell] = useState<{ relPath: string; colName: string } | null>(null);

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

  return (
    <div className="table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            <th onClick={() => onToggleSort("__title")}>
              {titleFieldLabel}
              {arrow("__title")}
            </th>
            {schema.map((c) => (
              <th key={c.name} onClick={() => onToggleSort(c.name)}>
                {c.name}
                {arrow(c.name)}
              </th>
            ))}
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
  return (
    <td
      key={c.name}
      className="editable-cell"
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
