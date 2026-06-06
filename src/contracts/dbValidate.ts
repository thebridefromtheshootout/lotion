import type { DbColumn, DbSchema } from "./databaseTypes";

// ── Runtime validation against schema constraints ──────────────────
//
// Pure functions over (column, value) and (schema, properties). No
// VS Code dependency — caller decides how to surface violations
// (input-box validator, diagnostic, toast). Lives in contracts/ so
// the webview can call into the same logic the extension host uses.

/** Inline ISO-date regex so the contracts layer doesn't depend on core/regex. */
const ISO_DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationViolation {
  col: string;
  message: string;
}

/**
 * Validate a single value against its column's constraints.
 * Returns the error message, or `undefined` when valid.
 *
 * Does NOT check uniqueness — that requires the rest of the DB and
 * is handled by `validateUniqueness` / `validateEntry`.
 */
export function validateColumnValue(col: DbColumn, value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();

  if (trimmed.length === 0) {
    return col.required ? `${col.name} is required` : undefined;
  }

  switch (col.type) {
    case "number": {
      const n = Number(trimmed);
      if (isNaN(n)) {
        return `${col.name} must be a number`;
      }
      if (col.min !== undefined && n < col.min) {
        return `${col.name} must be ≥ ${col.min}`;
      }
      if (col.max !== undefined && n > col.max) {
        return `${col.name} must be ≤ ${col.max}`;
      }
      return undefined;
    }

    case "date":
      return ISO_DATE_YMD.test(trimmed) ? undefined : `${col.name} must be YYYY-MM-DD`;

    case "checkbox":
      return trimmed === "true" || trimmed === "false" ? undefined : `${col.name} must be true or false`;

    case "select":
      if (col.options && col.options.length > 0 && !col.options.includes(trimmed)) {
        return `${col.name} must be one of: ${col.options.join(", ")}`;
      }
      return undefined;

    case "multi-select": {
      if (!col.options || col.options.length === 0) {
        return undefined;
      }
      const picks = trimmed
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const invalid = picks.filter((p) => !col.options!.includes(p));
      if (invalid.length > 0) {
        return `${col.name} contains unknown option(s): ${invalid.join(", ")}`;
      }
      return undefined;
    }

    case "coordinates": {
      const parts = trimmed.split(",").map((p) => p.trim());
      if (parts.length !== 2 || parts.some((p) => isNaN(Number(p)))) {
        return `${col.name} must be lat, lng`;
      }
      return undefined;
    }

    default:
      return undefined;
  }
}

/**
 * Normalise a cell value for unique-comparison. Strings are trimmed +
 * lowercased; multi-select values are reduced to a sorted set so that
 * "A, B" and "b, a" collide as duplicates.
 */
function normaliseForUniqueness(col: DbColumn, value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (col.type !== "multi-select") {
    return trimmed;
  }
  const items = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // De-duplicate within a single cell ("A, A" → "a") so reflexive
  // duplicates don't sneak past the cross-row check.
  return Array.from(new Set(items)).sort().join(",");
}

/**
 * Check whether `value` collides with any existing value for the same
 * unique column. `otherValues` should be the column's values from all
 * OTHER entries in the DB (exclude the entry being edited).
 *
 * Comparison is case-insensitive and trimmed — the same notion of
 * "equality" the filter runtime uses by default. For multi-select
 * columns the comparison is set-based (order-independent) so "A, B"
 * and "B, A" register as a duplicate.
 */
export function validateUniqueness(col: DbColumn, value: string, otherValues: string[]): string | undefined {
  if (!col.unique) {
    return undefined;
  }
  const needle = normaliseForUniqueness(col, value);
  if (needle.length === 0) {
    return undefined;
  }
  const clash = otherValues.some((v) => normaliseForUniqueness(col, v) === needle);
  return clash ? `${col.name} must be unique (value already exists)` : undefined;
}

/**
 * Validate a full property bag against a schema.
 * Returns one violation per offending column. Empty array means clean.
 *
 * @param otherEntries Optional — pass other entries' properties to enable
 *   uniqueness checks. Omit when validating the only entry (creation flow
 *   when the entry doesn't exist yet should pass all *other* entries here).
 */
export function validateEntry(
  schema: DbSchema,
  props: Record<string, string>,
  otherEntries: Record<string, string>[] = [],
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  for (const col of schema.columns) {
    const value = props[col.name];
    const valueError = validateColumnValue(col, value);
    if (valueError) {
      violations.push({ col: col.name, message: valueError });
      continue;
    }
    if (col.unique && value && value.trim().length > 0) {
      const others = otherEntries.map((e) => e[col.name] ?? "");
      const uniqueError = validateUniqueness(col, value, others);
      if (uniqueError) {
        violations.push({ col: col.name, message: uniqueError });
      }
    }
  }

  return violations;
}
