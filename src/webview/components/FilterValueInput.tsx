import React from "react";
import type { DbColumn, DbFilterOperator } from "../../contracts/databaseTypes";

// ── Type-aware value input ─────────────────────────────────────────

export type ValueInputKind = "text" | "number" | "date" | "url" | "boolean" | "select" | "multi-select" | "none";

export function inputKindFor(type: DbColumn["type"] | undefined, op: DbFilterOperator): ValueInputKind {
  if (op === "isempty" || op === "isnotempty") {
    return "none";
  }
  // Regex / between are always free-form text regardless of column type.
  if (op === "matches_regex" || op === "between") {
    return "text";
  }
  // `in` / `!in` accept a comma-separated list. For column types where we
  // know the option set (select / multi-select), still let the user check
  // multiple options to build that list.
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
      // For has_any / has_all / in / !in on a single-select column, fall
      // back to a checkbox list so the user can pick multiple options.
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
  options: string[] | undefined;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

export function FilterValueInput({ kind, options, value, onChange, onSubmit }: FilterValueInputProps) {
  if (kind === "none") {
    return (
      <input
        id="filterVal"
        type="text"
        placeholder="(no value)"
        value=""
        disabled
        readOnly
      />
    );
  }
  if (kind === "boolean") {
    // True/false columns get an actual checkbox + a label so the picked
    // value is unambiguous. Click toggles between "true" and "false".
    const checked = value === "true";
    return (
      <label id="filterVal" className="filter-checkbox-value" title="Filter value">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
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
              <input
                type="checkbox"
                checked={selected.has(o)}
                onChange={(e) => toggle(o, e.target.checked)}
              />
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
