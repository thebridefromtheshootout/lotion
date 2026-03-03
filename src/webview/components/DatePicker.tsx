import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DatePanelToExtensionCommunicator } from "../communicators/DatePanelToExtensionCommunicator";

const communicator = new DatePanelToExtensionCommunicator();

// ── Constants ────────────────────────────────────────────────────────

const MONTHS = [
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
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FORMAT_KEYS = [
  "YYYY-MM-DD",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "MMMM D, YYYY",
  "D MMMM YYYY",
  "ddd, MMMM D, YYYY",
  "YYYY-MM-DD HH:mm",
];

function pad(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

function formatDate(d: Date, fmt: string): string {
  const YYYY = "" + d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const D = "" + d.getDate();
  const MMMM = MONTHS[d.getMonth()];
  const ddd = DAY_NAMES[d.getDay()];
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return fmt
    .replace("YYYY", YYYY)
    .replace("MMMM", MMMM)
    .replace("MM", MM)
    .replace("DD", DD)
    .replace(/\bD\b/, D)
    .replace("ddd", ddd)
    .replace("HH", HH)
    .replace("mm", mm);
}

/** Try to parse a date string in common formats. Returns null on failure. */
function tryParseDate(s: string): Date | null {
  if (!s) return null;
  // ISO / YYYY-MM-DD variants
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  // MM/DD/YYYY
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (mdy) return new Date(+mdy[3], +mdy[1] - 1, +mdy[2]);
  // DD/MM/YYYY — ambiguous, try after MDY
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  // Natural: "January 5, 2026" / "5 January 2026" / "Mon, January 5, 2026"
  const nat = Date.parse(s);
  if (!isNaN(nat)) return new Date(nat);
  return null;
}

export function DatePicker() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [format, setFormat] = useState(FORMAT_KEYS[0]);

  // Target info from extension host
  const [targetDocUri, setTargetDocUri] = useState<string | null>(null);
  const [targetLine, setTargetLine] = useState(0);
  const [targetChar, setTargetChar] = useState(0);
  const [targetReplaceEnd, setTargetReplaceEnd] = useState<number | undefined>(undefined);

  // ── Register communicator listeners + signal ready ──────────────
  useEffect(() => {
    communicator.registerOnSetTarget((msg) => {
      setTargetDocUri(msg.docUri);
      setTargetLine(msg.line);
      setTargetChar(msg.character);
      setTargetReplaceEnd(msg.replaceEnd);
      // Pre-select existing date when updating
      if (msg.existingDate) {
        const parsed = tryParseDate(msg.existingDate);
        if (parsed) {
          setSelectedDate(parsed);
          setYear(parsed.getFullYear());
          setMonth(parsed.getMonth());
        }
      }
    });

    communicator.registerOnInit((msg) => {
      setFormat(msg.defaultFormat);
    });

    communicator.sendReady();
  }, []);

  // ── Calendar grid ──────────────────────────────────────────────
  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);

  const selStr = useMemo(() => {
    if (!selectedDate) return "";
    return `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`;
  }, [selectedDate]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const lastDate = new Date(year, month + 1, 0).getDate();
    const startDow = first.getDay();
    const prevLast = new Date(year, month, 0).getDate();
    const totalCells = Math.ceil((startDow + lastDate) / 7) * 7;

    const result: { date: Date; isOther: boolean; dateStr: string }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startDow + 1;
      let d: Date;
      let isOther = false;
      if (dayNum < 1) {
        d = new Date(year, month - 1, prevLast + dayNum);
        isOther = true;
      } else if (dayNum > lastDate) {
        d = new Date(year, month + 1, dayNum - lastDate);
        isOther = true;
      } else {
        d = new Date(year, month, dayNum);
      }
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      result.push({ date: d, isOther, dateStr });
    }
    return result;
  }, [year, month]);

  // ── Actions ────────────────────────────────────────────────────
  const pickDate = useCallback((d: Date) => {
    setSelectedDate(d);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }, []);

  const prevMonth = useCallback(() => {
    setMonth((m) => {
      if (m <= 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setMonth((m) => {
      if (m >= 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  }, []);

  const insertDate = useCallback(
    (overrideDate?: Date) => {
      const d = overrideDate || selectedDate;
      if (!d || !targetDocUri) return;
      communicator.sendInsertDate({
        formatted: formatDate(d, format),
        format,
        docUri: targetDocUri,
        line: targetLine,
        character: targetChar,
        replaceEnd: targetReplaceEnd,
      });
    },
    [selectedDate, format, targetDocUri, targetLine, targetChar, targetReplaceEnd],
  );

  // ── Keyboard navigation ────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "SELECT") return;
      const d = selectedDate || new Date();
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          pickDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          pickDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          pickDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
          break;
        case "ArrowDown":
          e.preventDefault();
          pickDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
          break;
        case "PageUp":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) setYear((y) => y - 1);
          else prevMonth();
          break;
        case "PageDown":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) setYear((y) => y + 1);
          else nextMonth();
          break;
        case "Home":
          e.preventDefault();
          goToday();
          break;
        case "Enter":
          e.preventDefault();
          insertDate();
          break;
        case "Escape":
          e.preventDefault();
          communicator.sendClose();
          break;
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [selectedDate, pickDate, prevMonth, nextMonth, goToday, insertDate]);

  const preview = selectedDate ? formatDate(selectedDate, format) : "Select a date…";

  return (
    <>
      <h2>📅 Pick a Date</h2>

      <div className="format-bar">
        <label>Format:</label>
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          {FORMAT_KEYS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="nav">
        <button onClick={prevMonth}>◀</button>
        <span className="month-label">
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth}>▶</button>
        <button onClick={goToday}>Today</button>
      </div>

      <div className="calendar">
        {DAY_NAMES.map((d) => (
          <div key={d} className="day-header">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          const cls = ["day-cell"];
          if (cell.isOther) cls.push("other-month");
          if (cell.dateStr === todayStr) cls.push("today");
          if (cell.dateStr === selStr) cls.push("selected");
          return (
            <div
              key={i}
              className={cls.join(" ")}
              onClick={() => pickDate(cell.date)}
              onDoubleClick={() => insertDate(cell.date)}
            >
              {cell.date.getDate()}
            </div>
          );
        })}
      </div>

      <div className="preview">{preview}</div>
      <button className="insert-btn" disabled={!selectedDate} onClick={() => insertDate()}>
        Insert Date
      </button>
    </>
  );
}
