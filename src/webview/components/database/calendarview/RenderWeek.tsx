import React from "react";
import type { DbPanelToExtensionCommunicator } from "../../../communicators/DbPanelToExtensionCommunicator";
import { DAY_NUM_H, SLOT_H } from "./CalendarView";
import { IWeekProfile } from "../../../types/CalendarTypes";
import { dfmt, addDays, daysBetween } from "../../../utils/calendarUtils";

/** Drag-data payload serialised into the dataTransfer. */
interface CalDragData {
  relativePath: string;
  startDate: string;
  endDate: string;
  isRange: boolean;
}

/** Resize-drag payload — only the dragged edge changes. */
interface CalResizeData {
  relativePath: string;
  edge: "start" | "end";
  startDate: string;
  endDate: string;
}

const DRAG_MIME = "application/x-lotion-cal-event";
const RESIZE_MIME = "application/x-lotion-cal-resize";

export function RenderWeek(
  communicator: DbPanelToExtensionCommunicator,
  dateCol: string,
  endCol: string,
  weekProfile: IWeekProfile,
): React.JSX.Element {
  const { weekCells, assignments, spacerH, weekIndex } = weekProfile;

  // ── Drop handler for day cells ──────────────────────────────────
  function hasCalDrag(types: DOMStringList | readonly string[]): boolean {
    return Array.from(types).some((t) => t === DRAG_MIME || t === RESIZE_MIME);
  }

  function handleDragOver(e: React.DragEvent) {
    if (hasCalDrag(e.dataTransfer.types)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    if (hasCalDrag(e.dataTransfer.types)) {
      (e.currentTarget as HTMLElement).classList.add("drag-over");
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    const el = e.currentTarget as HTMLElement;
    if (!el.contains(e.relatedTarget as Node)) {
      el.classList.remove("drag-over");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove("drag-over");

    const targetDate = (e.currentTarget as HTMLElement).getAttribute("data-date");
    if (!targetDate) return;

    // ── Resize drop ──
    const resizeRaw = e.dataTransfer.getData(RESIZE_MIME);
    if (resizeRaw) {
      const data: CalResizeData = JSON.parse(resizeRaw);
      if (data.edge === "start" && targetDate <= data.endDate) {
        communicator.sendUpdateEntryProperty(data.relativePath, dateCol, targetDate);
      } else if (data.edge === "end" && endCol && targetDate >= data.startDate) {
        communicator.sendUpdateEntryProperty(data.relativePath, endCol, targetDate);
      }
      return;
    }

    // ── Move drop ──
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;

    const data: CalDragData = JSON.parse(raw);
    if (targetDate === data.startDate) return;

    communicator.sendUpdateEntryProperty(data.relativePath, dateCol, targetDate);

    if (data.isRange && endCol) {
      const delta = daysBetween(data.startDate, targetDate);
      const newEnd = addDays(data.endDate, delta);
      communicator.sendUpdateEntryProperty(data.relativePath, endCol, newEnd);
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div key={weekIndex} className="cal-week">
      {weekCells.map((c, di) => {
        const cls = ["cal-day"];
        if (c.other) cls.push("other-month");
        if (c.isToday) cls.push("today");
        return (
          <div
            key={di}
            className={cls.join(" ")}
            data-date={c.str}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="cal-day-num">{c.date.getDate()}</div>
            <button
              className="cal-day-add"
              onClick={() => communicator.sendAddEntry({ [dateCol]: c.str })}
              title={`New entry on ${c.str}`}
            >
              +
            </button>
            <div className="cal-event-spacer" style={{ height: spacerH }} />
          </div>
        );
      })}
      {assignments.map((a, ai) => {
        const we = a.we;
        const left = (we.startCol / 7) * 100;
        const width = (we.span / 7) * 100;
        const top = DAY_NUM_H + a.slot * SLOT_H;
        let cls = "cal-bar";
        if (we.contLeft) cls += " cont-left";
        if (we.contRight) cls += " cont-right";

        const dragData: CalDragData = {
          relativePath: we.ev.relativePath,
          startDate: dfmt(we.ev.start),
          endDate: dfmt(we.ev.end),
          isRange: we.ev.isRange,
        };

        const showResizeHandles = we.ev.isRange && !!endCol;

        function startResize(edge: "start" | "end") {
          return (e: React.DragEvent) => {
            e.stopPropagation();
            const resizeData: CalResizeData = {
              relativePath: we.ev.relativePath,
              edge,
              startDate: dfmt(we.ev.start),
              endDate: dfmt(we.ev.end),
            };
            e.dataTransfer.setData(RESIZE_MIME, JSON.stringify(resizeData));
            e.dataTransfer.effectAllowed = "move";
          };
        }

        return (
          <a
            key={ai}
            className={cls}
            style={{ left: `${left.toFixed(4)}%`, width: `${width.toFixed(4)}%`, top }}
            href="#"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, JSON.stringify(dragData));
              e.dataTransfer.effectAllowed = "move";
              (e.currentTarget as HTMLElement).classList.add("dragging");
            }}
            onDragEnd={(e) => {
              (e.currentTarget as HTMLElement).classList.remove("dragging");
            }}
            onClick={(e) => {
              e.preventDefault();
              communicator.sendOpenEntry(we.ev.relativePath);
            }}
            title={we.ev.title}
          >
            {showResizeHandles && !we.contLeft && (
              <span
                className="cal-resize-handle cal-resize-left"
                draggable
                onDragStart={startResize("start")}
              />
            )}
            {we.ev.title}
            {showResizeHandles && !we.contRight && (
              <span
                className="cal-resize-handle cal-resize-right"
                draggable
                onDragStart={startResize("end")}
              />
            )}
          </a>
        );
      })}
    </div>
  );
}
