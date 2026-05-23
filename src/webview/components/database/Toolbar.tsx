import React from "react";
import { DbColumn, DbViewData, LayoutKind, ToolbarProps } from "../../types";
import type { DbPanelToExtensionCommunicator } from "../../communicators/DbPanelToExtensionCommunicator";
import { Icon } from "../Icon";

export function Toolbar({
  layout,
  setLayout,
  schema,
  views,
  activeViewName,
  onLoadView,
  onSaveView,
  onCopyViewAsCsv,
  communicator,
}: ToolbarProps) {
  const hasSelect = schema.some((c) => c.type === "select");
  const hasDate = schema.some((c) => c.type === "date");
  const hasCoordinates = schema.some((c) => c.type === "coordinates");

  function handleToggleKanban() {
    if (layout === "kanban") {
      setLayout("table");
      return;
    }
    if (!hasSelect) {
      communicator.sendShowWarning("Kanban view requires at least one Single Select field in the schema.");
      return;
    }
    setLayout("kanban");
  }

  function handleToggleCalendar() {
    if (layout === "calendar") {
      setLayout("table");
      return;
    }
    if (!hasDate) {
      communicator.sendShowWarning("Calendar view requires at least one Date field in the schema.");
      return;
    }
    setLayout("calendar");
  }

  function handleToggleMap() {
    if (layout === "map") {
      setLayout("table");
      return;
    }
    if (!hasCoordinates) {
      communicator.sendShowWarning("Map view requires at least one Coordinates field in the schema.");
      return;
    }
    setLayout("map");
  }

  return (
    <div className="toolbar">
      <button onClick={() => communicator.sendAddEntry()}>
        <Icon name="add" /> New Entry
      </button>
      <button onClick={() => communicator.sendRefresh()}>
        <Icon name="refresh" /> Refresh
      </button>
      <button onClick={onSaveView}>
        <Icon name="save" /> Save View
      </button>
      <button onClick={onCopyViewAsCsv} title="Copy current view as CSV">
        <Icon name="copy" /> Copy CSV
      </button>
      <select value={activeViewName} onChange={(e) => onLoadView(e.target.value)}>
        <option value="">— Views —</option>
        {views.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name}
            {v.default ? " (default)" : ""}
          </option>
        ))}
      </select>
      <span style={{ flex: 1 }} />
      <div className="layout-toggle">
        <button
          className={`layout-btn${layout === "table" ? " active" : ""}`}
          onClick={() => setLayout("table")}
          title="Table view"
          aria-label="Table view"
        >
          <Icon name="list-flat" />
        </button>
        <button
          className={`layout-btn${layout === "kanban" ? " active" : ""}`}
          onClick={handleToggleKanban}
          title={hasSelect ? "Kanban board" : "Kanban requires at least one Single Select field"}
          aria-label="Kanban board"
          disabled={!hasSelect && layout !== "kanban"}
          style={!hasSelect ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          <Icon name="layout" />
        </button>
        <button
          className={`layout-btn${layout === "calendar" ? " active" : ""}`}
          onClick={handleToggleCalendar}
          title={hasDate ? "Calendar view" : "Calendar requires at least one Date field"}
          aria-label="Calendar view"
          disabled={!hasDate && layout !== "calendar"}
          style={!hasDate ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          <Icon name="calendar" />
        </button>
        <button
          className={`layout-btn${layout === "graph" ? " active" : ""}`}
          onClick={() => setLayout(layout === "graph" ? "table" : "graph")}
          title="Graph view"
          aria-label="Graph view"
        >
          <Icon name="type-hierarchy" />
        </button>
        <button
          className={`layout-btn${layout === "map" ? " active" : ""}`}
          onClick={handleToggleMap}
          title={hasCoordinates ? "Map view" : "Map requires at least one Coordinates field"}
          aria-label="Map view"
          disabled={!hasCoordinates && layout !== "map"}
          style={!hasCoordinates ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          <Icon name="globe" />
        </button>
      </div>
    </div>
  );
}
