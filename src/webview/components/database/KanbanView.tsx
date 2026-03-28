import React, { useState, useRef } from "react";
import { DbEntryData } from "../../types";
import { KanbanViewProps } from "../../types/KanbanTypes";
import { FormatCell } from "./tableview/FormatCell";
import type { DbPanelToExtensionCommunicator } from "../../communicators/DbPanelToExtensionCommunicator";
import { ColumnNameOptions } from "../ColumnNameOptions";

export function KanbanView({
  entries,
  schema,
  kanbanGroupCol,
  onKanbanGroupColChange,
  baseUri,
  communicator,
}: KanbanViewProps) {
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);

  const selectCols = schema.filter((c) => c.type === "select");
  const groupCol = kanbanGroupCol || (selectCols[0]?.name ?? "");

  if (!groupCol) {
    return (
      <div className="empty-state">
        No select column available for grouping. Add a "select" type column to use Kanban view.
      </div>
    );
  }

  const colDef = schema.find((c) => c.name === groupCol);
  const options = colDef?.options ?? [];

  // Group entries by column value
  const groups: Record<string, DbEntryData[]> = {};
  const uncategorized: DbEntryData[] = [];
  options.forEach((o) => {
    groups[o] = [];
  });

  entries.forEach((e) => {
    const val = (e.properties[groupCol] || "").trim();
    if (val && groups[val] !== undefined) {
      groups[val].push(e);
    } else if (val) {
      if (!groups[val]) groups[val] = [];
      groups[val].push(e);
    } else {
      uncategorized.push(e);
    }
  });

  // Card property columns (exclude grouping column, max 3)
  const cardCols = schema.filter((c) => c.name !== groupCol).slice(0, 3);

  // Build lane list
  const allLanes = [...options, ...Object.keys(groups).filter((k) => !options.includes(k))];
  const uniqueLanes = [...new Set(allLanes)];
  if (uncategorized.length > 0) uniqueLanes.unshift("__uncategorized");

  function handleDrop(laneValue: string) {
    if (!draggedPath || laneValue === "__uncategorized") return;
    communicator.sendUpdateEntryProperty(draggedPath, groupCol, laneValue);
    setDraggedPath(null);
    setDragOverLane(null);
  }

  return (
    <>
      <div className="filter-bar view-controls">
        <label className="view-control-label">Group by:</label>
        <select
          value={groupCol}
          onChange={(e) => onKanbanGroupColChange(e.target.value)}
          className="view-control-select"
        >
          <ColumnNameOptions columns={selectCols} />
        </select>
      </div>
      <div className="kanban-board">
        {uniqueLanes.map((lane) => {
          const laneEntries = lane === "__uncategorized" ? uncategorized : groups[lane] || [];
          const laneTitle = lane === "__uncategorized" ? "Uncategorized" : lane;
          return (
            <div
              key={lane}
              className={`kanban-lane${dragOverLane === lane ? " drag-over" : ""}`}
              data-lane={lane}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverLane(lane);
              }}
              onDragLeave={() => setDragOverLane(null)}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(lane);
              }}
            >
              <div className="kanban-lane-header">
                <span className="kanban-lane-title">{laneTitle}</span>
                <span className="kanban-lane-count">{laneEntries.length}</span>
              </div>
              {laneEntries.length === 0 ? (
                <div className="kanban-empty">No items</div>
              ) : (
                laneEntries.map((e) => (
                  <div
                    key={e.relativePath}
                    className={`kanban-card${draggedPath === e.relativePath ? " dragging" : ""}`}
                    draggable
                    onDragStart={(ev) => {
                      setDraggedPath(e.relativePath);
                      ev.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => communicator.sendOpenEntry(e.relativePath)}
                  >
                    <div className="kanban-card-title">{e.title}</div>
                    <div className="kanban-card-props">
                      {cardCols.map((c) => {
                        const val = e.properties[c.name] || "";
                        if (!val) return null;
                        return (
                          <span key={c.name} className="kanban-card-prop">
                            <FormatCell
                              value={val}
                              type={c.type}
                              baseUri={baseUri}
                              maxWidth={c.maxWidth}
                              maxHeight={c.maxHeight}
                            />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
