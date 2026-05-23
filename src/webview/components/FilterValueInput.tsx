import React from "react";
import type { DbColumn, DbFilterOperator } from "../../contracts/databaseTypes";

// ── Type-aware value input ─────────────────────────────────────────

export type ValueInputKind = "text" | "number" | "date" | "url" | "boolean" | "select" | "multi-select" | "none";

export function inputKindFor(type: DbColumn["type"] | undefined, op: DbFilterOperator): ValueInputKind {
  if (op === "isempty" || op === "isnotempty") {
    return "none";
  }
  if (op === "matches_regex") {
    return "text";
  }
  // `between` keeps the column's natural input kind — the two-input shape
  // is handled by `FilterValueInput` itself, not by collapsing to "text".
  // `in` / `!in` accept a list. For column types where we know the option
  // set (select / multi-select), let the user check multiple options.
  switch (type) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "checkbox":
      return "boolean";
    case "url":
      return "url";
    case "select":
      if (op === "has_any" || op === "has_all" || op === "in" || op === "!in") {
        return "multi-select";
      }
      return "select";
    case "multi-select":
      return "multi-select";
    default:
      return "text";
  }
}

interface FilterValueInputProps {
  kind: ValueInputKind;
  op: DbFilterOperator;
  options: string[] | undefined;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

/** Split / join the comma-separated payload used for `between` (low, high). */
function splitBetween(value: string): [string, string] {
  const parts = value.split(",").map((s) => s.trim());
  return [parts[0] ?? "", parts[1] ?? ""];
}
function joinBetween(low: string, high: string): string {
  return [low, high].map((s) => s.trim()).join(", ");
}

export function FilterValueInput({ kind, op, options, value, onChange, onSubmit }: FilterValueInputProps) {
  // `between` always needs two values of the column's natural type; the
  // single-input branches below don't know how to render a pair, so we
  // short-circuit here. Only the typed kinds make sense for a range
  // (number, date, text) — select/multi-select/boolean fall back to text.
  if (op === "between") {
    const betweenKind: "number" | "date" | "text" = kind === "number" || kind === "date" ? kind : "text";
    const [low, high] = splitBetween(value);
    return (
      <span id="filterVal" className="filter-between" role="group" aria-label="Between range">
        <input
          type={betweenKind}
          placeholder="from"
          value={low}
          onChange={(e) => onChange(joinBetween(e.target.value, high))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
        <span className="filter-between-sep" aria-hidden="true">
          …
        </span>
        <input
          type={betweenKind}
          placeholder="to"
          value={high}
          onChange={(e) => onChange(joinBetween(low, e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
      </span>
    );
  }
  if (kind === "none") {
    return <input id="filterVal" type="text" placeholder="(no value)" value="" disabled readOnly />;
  }
  if (kind === "boolean") {
    // True/false columns get an actual checkbox + a label so the picked
    // value is unambiguous. Click toggles between "true" and "false".
    const checked = value === "true";
    return (
      <label id="filterVal" className="filter-checkbox-value" title="Filter value">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked ? "true" : "false")} />
        <span>{checked ? "true" : "false"}</span>
      </label>
    );
  }
  if (kind === "select") {
    return (
      <select id="filterVal" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "multi-select") {
    const selected = new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    function toggle(opt: string, checked: boolean) {
      const next = new Set(selected);
      if (checked) next.add(opt);
      else next.delete(opt);
      onChange(Array.from(next).join(", "));
    }
    return (
      <div id="filterVal" className="filter-multi-select" role="group">
        {(options ?? []).length === 0 ? (
          <span className="filter-empty-options">no options defined</span>
        ) : (
          (options ?? []).map((o) => (
            <label key={o} className="filter-multi-select-option">
              <input type="checkbox" checked={selected.has(o)} onChange={(e) => toggle(o, e.target.checked)} />
              <span>{o}</span>
            </label>
          ))
        )}
      </div>
    );
  }
  return (
    <input
      id="filterVal"
      type={kind}
      placeholder="value…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit();
      }}
    />
  );
}
