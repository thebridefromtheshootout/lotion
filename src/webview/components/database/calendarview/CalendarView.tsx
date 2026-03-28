import React, { useState } from "react";
import { 
  CalendarViewProps, 
  CalEvent, 
  IWeekProfile, 
  IMonthProfile
} from "../../../types/CalendarTypes";
import { RenderWeek } from "./RenderWeek";
import { DAY_NAMES, dfmt, getMonthProfile, getWeekProfile, MONTH_NAMES, parseDate } from "../../../utils/calendarUtils";
import { DbColumn } from "../../../types";

export const SLOT_H = 22;
export const DAY_NUM_H = 26;
// ── Parse events ──

export function CalendarView({
  entries,
  schema,
  calendarDateCol,
  calendarEndDateCol,
  onCalendarDateColChange,
  onCalendarEndDateColChange,
  communicator,
}: CalendarViewProps) {
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const dateCols = schema.filter((c) => c.type === "date");
  const dateColumn = calendarDateCol || dateCols[0]?.name || "";
  const endCol = calendarEndDateCol || "";

  if (!dateColumn) {
    return <div className="empty-state">No date column selected.</div>;
  }

  // ── Calendar navigation ──
  function calPrev() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else setCalMonth((m) => m - 1);
  }
  function calNext() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else setCalMonth((m) => m + 1);
  }
  function calToday() {
    const t = new Date();
    setCalYear(t.getFullYear());
    setCalMonth(t.getMonth());
  }

  const events: CalEvent[] = [];
  entries.forEach((e) => {
    const ds = (e.properties[dateColumn] || "").trim();
    if (!ds) return;
    const start = parseDate(ds);
    if (!start) return;
    let end: Date | null = null;
    if (endCol) {
      const es = (e.properties[endCol] || "").trim();
      if (es) end = parseDate(es);
    }
    events.push({
      title: e.title,
      start,
      end: end || start,
      relativePath: e.relativePath,
      isRange: !!end && !!endCol,
    });
  });



  // ── Build calendar grid ──
  const { numWeeks, cells }: IMonthProfile = getMonthProfile(calYear, calMonth);

  // ── Render weeks ──
  const weeks: React.JSX.Element[] = [];


  for (let w = 0; w < numWeeks; w++) {
    const weekProfile: IWeekProfile = getWeekProfile(cells, w, events);
    weeks.push(RenderWeek(communicator, dateColumn, endCol, weekProfile));
  }

  return (
    <>
      <div className="filter-bar view-controls">
        {DateColumnSelection(dateColumn, onCalendarDateColChange, dateCols, endCol, onCalendarEndDateColChange)}
        <span style={{ flex: 1 }} />
        {CalendarNavigation(calPrev, calMonth, calYear, calNext, calToday)}
      </div>
      <div className="cal-container">
        {DayNameHeadings()}
        {weeks}
      </div>
    </>
  );
}
function CalendarNavigation(calPrev: () => void, calMonth: number, calYear: number, calNext: () => void, calToday: () => void) {
  return <>
    <button onClick={calPrev} className="cal-nav-btn">
      ◀
    </button>
    <span className="cal-nav-label">
      {MONTH_NAMES[calMonth]} {calYear}
    </span>
    <button onClick={calNext} className="cal-nav-btn">
      ▶
    </button>
    <button onClick={calToday} className="cal-today-btn">
      Today
    </button>
  </>;
}

function DayNameHeadings() {
  return <div className="cal-header">
    {DAY_NAMES.map((d) => (
      <div key={d} className="cal-header-cell">
        {d}
      </div>
    ))}
  </div>;
}

function DateColumnSelection(dateColumn: string, onCalendarDateColChange: (col: string) => void, dateCols: DbColumn[], endCol: string, onCalendarEndDateColChange: (col: string | undefined) => void) {
  const dateColumnOptions = renderColumnOptions(dateCols);
  return <>
    <label className="view-control-label">Date column:</label>
    <select
      value={dateColumn}
      onChange={(e) => onCalendarDateColChange(e.target.value)}
      className="view-control-select"
    >
      {dateColumnOptions}
    </select>

    {dateCols.length > 1 && (
      <>
        <label className="view-control-label">End date:</label>
        <select
          value={endCol}
          onChange={(e) => onCalendarEndDateColChange(e.target.value || undefined)}
          className="view-control-select"
        >
          <option value="">— none —</option>
          {dateColumnOptions}
        </select>
      </>
    )}
  </>;
}

function renderColumnOptions(columns: DbColumn[]) {
  return columns.map((column) => (
    <option key={column.name} value={column.name}>
      {column.name}
    </option>
  ));
}

