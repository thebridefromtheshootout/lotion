import { CellData, CalEvent, WeekEvent, Assignment, IWeekProfile, IMonthProfile } from "../types/CalendarTypes";
import { SLOT_H } from "../components/database/calendarview/CalendarView";
import { Regex } from "../../core/regex";

const MAX_SLOTS = 50;
export function dfmt(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Add `days` (positive or negative) to a YYYY-MM-DD string and return the result. */
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)!;
  d.setDate(d.getDate() + days);
  return dfmt(d);
}

/** Return the signed number of days from `a` to `b` (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const da = parseDate(a)!;
  const db = parseDate(b)!;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function parseDate(s: string): Date | null {
  if (!s) return null;
  const iso = s.match(Regex.dateIsoLoose);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const mdy = s.match(Regex.dateSlashMdy);
  if (mdy) return new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
  const dv = new Date(s);
  return isNaN(dv.getTime()) ? null : dv;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function getMonthProfile(calYear: number, calMonth: number): IMonthProfile {
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const prevMonthLast = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  const todayStr = dfmt(today);
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const numWeeks = totalCells / 7;

  const cells: CellData[] = [];
  for (let ci = 0; ci < totalCells; ci++) {
    const dayNum = ci - startDow + 1;
    let d: Date;
    let other = false;
    if (dayNum < 1) {
      d = new Date(calYear, calMonth - 1, prevMonthLast + dayNum);
      other = true;
    } else if (dayNum > daysInMonth) {
      d = new Date(calYear, calMonth + 1, dayNum - daysInMonth);
      other = true;
    } else {
      d = new Date(calYear, calMonth, dayNum);
    }
    cells.push({ date: d, str: dfmt(d), other, isToday: dfmt(d) === todayStr });
  }
  return { numWeeks, cells };
}

export function getWeekProfile(cells: CellData[], w: number, events: CalEvent[]): IWeekProfile {
  const weekStartLoc = w * 7;
  const weekCells = cells.slice(weekStartLoc, weekStartLoc + 7);
  const weekStart = weekCells[0].str;
  const weekEnd = weekCells[6].str;

  const weekEvents: WeekEvent[] = mapEventsToWeeks(events, weekStart, weekEnd, weekCells);

  // Sort: multi-day first (longer span first), then by start column
  weekEvents.sort((a, b) => {
    if (a.isMultiDay && !b.isMultiDay) return -1;
    if (!a.isMultiDay && b.isMultiDay) return 1;
    if (a.span !== b.span) return b.span - a.span;
    return a.startCol - b.startCol;
  });

  // Assign slots (greedy first-fit) — no limit, all events are visible
  const slotOccupied: [number, number][][] = [];
  const assignments: Assignment[] = [];

  for (const we of weekEvents) {
    for (let s = 0; s < MAX_SLOTS; s++) {
      if (!slotOccupied[s]) slotOccupied[s] = [];
      const free = slotOccupied[s].every((r) => we.endCol < r[0] || we.startCol > r[1]);
      if (free) {
        slotOccupied[s].push([we.startCol, we.endCol]);
        assignments.push({ we, slot: s });
        break;
      }
    }
  }

  const maxSlot = assignments.reduce((mx, a) => Math.max(mx, a.slot), -1) + 1;
  const spacerH = maxSlot * SLOT_H;

  return { weekIndex: w, weekCells, spacerH, assignments };
}

function mapEventsToWeeks(events: CalEvent[], weekStart: string, weekEnd: string, weekCells: CellData[]): WeekEvent[] {
  const weekEvents: WeekEvent[] = [];
  // weekStart and weekEnd are dates string "YYYY-MM-DD"

  for (const ev of events) {
    const evS = dfmt(ev.start);
    const evE = dfmt(ev.end);
    
    // Check intersection
    // Logic: event start <= week end AND event end >= week start
    if (evE >= weekStart && evS <= weekEnd) {
      // Logic for start column:
      // If event starts before week, clamp to 0. Else find index in weekCells.
      let startColVal = 0;
      let contLeft = false;

      if (evS < weekStart) {
        startColVal = 0;
        contLeft = true;
      } else {
        const idx = weekCells.findIndex((c) => c.str === evS);
        startColVal = idx === -1 ? 0 : idx; // Should always be found if inside range
      }

      // Logic for end column:
      // If event ends after week, clamp to 6. Else find index.
      let endColVal = 6;
      let contRight = false;

      if (evE > weekEnd) {
        endColVal = 6;
        contRight = true;
      } else {
        const idx = weekCells.findIndex((c) => c.str === evE);
        endColVal = idx === -1 ? 6 : idx;
      }

      const spanVal = endColVal - startColVal + 1;
      
      weekEvents.push({
        ev,
        startCol: startColVal,
        endCol: endColVal,
        span: spanVal,
        contLeft,
        contRight,
        isMultiDay: ev.isRange && evS !== evE,
      });
    }
  }

  return weekEvents;
}
