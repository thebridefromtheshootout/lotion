import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DatePanelToExtensionCommunicator } from "../communicators/DatePanelToExtensionCommunicator";
import { DAY_NAMES, FORMAT_KEYS, MONTHS, formatDate, pad, tryParseDate } from "../utils/dateUtils";

const communicator = new DatePanelToExtensionCommunicator();

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
