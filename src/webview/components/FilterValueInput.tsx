import React, { useState } from "react";
import type { DbColumn, DbFilterOperator } from "../../contracts/databaseTypes";
import { Icon } from "./Icon";

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

/** Split / join the comma-separated payload used for `in` / `!in` lists. */
function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function joinList(items: string[]): string {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

// `in` / `!in` on free-form columns (text, number, url) want a chip-builder
// instead of raw comma-separated text — users shouldn't need to know the
// underlying separator. Storage stays comma-separated for runtime compat.
function ChipListInput({
  inputType,
  value,
  onChange,
  onSubmit,
}: {
  inputType: "text" | "number" | "url";
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const items = splitList(value);
  const [draft, setDraft] = useState("");

  function addDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange(joinList([...items, trimmed]));
    setDraft("");
  }
  function removeAt(i: number) {
    onChange(joinList(items.filter((_, idx) => idx !== i)));
  }

  return (
    <span id="filterVal" className="filter-chip-list" role="group" aria-label="Value list">
      {items.map((item, i) => (
        <span key={i} className="filter-chip-list-item">
          {item}
          <button
            type="button"
            className="filter-chip-list-remove"
            aria-label={`Remove ${item}`}
            onClick={() => removeAt(i)}
          >
            <Icon name="close" />
          </button>
        </span>
      ))}
      <input
        type={inputType}
        className="filter-chip-list-input"
        placeholder={items.length === 0 ? "value, Enter to add" : "add another…"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) {
              addDraft();
            } else {
              onSubmit();
            }
          } else if (e.key === "Backspace" && !draft && items.length > 0) {
            // Pop the last chip when backspacing into an empty input.
            removeAt(items.length - 1);
          } else if (e.key === "," || e.key === "Tab") {
            // Comma or Tab also commits a chip — matches the common chip
            // input idiom (Gmail recipients, GitHub topic tags, etc.).
            if (draft.trim()) {
              e.preventDefault();
              addDraft();
            }
          }
        }}
      />
    </span>
  );
}

// Returns the JS RegExp parse error for `pattern`, or null if it's valid.
// Empty pattern is treated as valid (the user is still typing).
function regexParseError(pattern: string): string | null {
  if (!pattern) return null;
  try {
    new RegExp(pattern);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function RegexInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const error = regexParseError(value);
  const invalid = error !== null;
  return (
    <input
      id="filterVal"
      type="text"
      className={`filter-regex-input${invalid ? " invalid" : ""}`}
      placeholder="/regex/"
      value={value}
      title={invalid ? `Invalid regex: ${error}` : "Case-insensitive regex"}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit();
      }}
    />
  );
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
  // `in` / `!in` on free-form columns: chip builder. Select / multi-select
  // columns already get the checkbox-list branch below; this targets the
  // text/number/url shapes that otherwise force the user to type commas.
  if ((op === "in" || op === "!in") && (kind === "text" || kind === "number" || kind === "url")) {
    return <ChipListInput inputType={kind} value={value} onChange={onChange} onSubmit={onSubmit} />;
  }
  // `matches_regex` needs live validation — the runtime catches bad regex
  // and returns false silently, so without UI feedback the user can't tell
  // "no matches" from "broken regex." Surface the parse error inline.
  if (op === "matches_regex") {
    return <RegexInput value={value} onChange={onChange} onSubmit={onSubmit} />;
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
