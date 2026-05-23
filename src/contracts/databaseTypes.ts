// ── Canonical database types shared between extension host and webview ──

// ── Column & Schema ────────────────────────────────────────────────

export interface DbColumn {
  name: string;
  type: "text" | "number" | "select" | "multi-select" | "date" | "checkbox" | "url" | "image" | "coordinates";
  options?: string[];
  maxWidth?: number;
  maxHeight?: number;
}

export interface DbSchema {
  columns: DbColumn[];
  /** The user-chosen label for the title/name field (defaults to "Name") */
  titleField?: string;
}

// ── Filter & View ──────────────────────────────────────────────────

/**
 * KQL-style filter operators supported in database views.
 */
export type DbFilterOperator =
  | "=="
  | "!="
  | "contains"
  | "!contains"
  | "startswith"
  | "!startswith"
  | "endswith"
  | "!endswith"
  | "matches_regex"
  | ">"
  | ">="
  | "<"
  | "<="
  | "between"
  | "in"
  | "!in"
  | "has_any"
  | "has_all"
  | "isempty"
  | "isnotempty";

// ── Operator validity per column type ──────────────────────────────
//
// Which operators make sense for which column types. The runtime in
// filterSort.ts has silent fallbacks (lowercase-string compare when a
// numeric op gets non-numeric input), so the UI is the only place where
// nonsense combinations like `matches_regex` on a checkbox or `between`
// on a select can be prevented.

const TEXT_OPS: DbFilterOperator[] = [
  "contains",
  "!contains",
  "==",
  "!=",
  "startswith",
  "!startswith",
  "endswith",
  "!endswith",
  "matches_regex",
  "in",
  "!in",
  "isempty",
  "isnotempty",
];

const URL_OPS: DbFilterOperator[] = [
  "contains",
  "!contains",
  "==",
  "!=",
  "startswith",
  "!startswith",
  "endswith",
  "!endswith",
  "matches_regex",
  "isempty",
  "isnotempty",
];

const NUMERIC_OPS: DbFilterOperator[] = [
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "between",
  "in",
  "!in",
  "isempty",
  "isnotempty",
];

const DATE_OPS: DbFilterOperator[] = ["==", "!=", ">", ">=", "<", "<=", "between", "isempty", "isnotempty"];

// Checkbox columns only expose "==" — "is true" and "is false" are
// expressed by toggling the value, not by flipping operators. Dropping
// "!=" removes a redundant cognitive choice (`!= true` ≡ `== false`).
const CHECKBOX_OPS: DbFilterOperator[] = ["=="];

const SELECT_OPS: DbFilterOperator[] = ["==", "!=", "in", "!in", "isempty", "isnotempty"];

const MULTI_SELECT_OPS: DbFilterOperator[] = ["has_any", "has_all", "in", "!in", "contains", "isempty", "isnotempty"];

const IMAGE_COORD_OPS: DbFilterOperator[] = ["isempty", "isnotempty"];

/** All operators valid for the given column type. */
export function validOperatorsFor(type: DbColumn["type"] | undefined): DbFilterOperator[] {
  switch (type) {
    case "number":
      return NUMERIC_OPS;
    case "date":
      return DATE_OPS;
    case "checkbox":
      return CHECKBOX_OPS;
    case "select":
      return SELECT_OPS;
    case "multi-select":
      return MULTI_SELECT_OPS;
    case "url":
      return URL_OPS;
    case "image":
    case "coordinates":
      return IMAGE_COORD_OPS;
    case "text":
    default:
      return TEXT_OPS;
  }
}

/** The most sensible default operator to pre-select for a column type. */
export function defaultOperatorFor(type: DbColumn["type"] | undefined): DbFilterOperator {
  switch (type) {
    case "number":
    case "date":
    case "checkbox":
    case "select":
      return "==";
    case "multi-select":
      return "has_any";
    case "image":
    case "coordinates":
      return "isnotempty";
    default:
      return "contains";
  }
}

export interface DbViewFilter {
  col: string;
  op: DbFilterOperator;
  value: string;
}

/** The group branch of `DbFilterClause` — combines children with a logical operator. */
export interface DbFilterGroup {
  logic: "AND" | "OR";
  clauses: DbFilterClause[];
  not?: boolean;
}

/**
 * A compound filter clause supports nested AND / OR grouping.
 *
 * - A **leaf** clause is a simple `DbViewFilter` (`{ col, op, value }`).
 * - A **group** clause is a `DbFilterGroup` (`{ logic, clauses, not? }`).
 */
export type DbFilterClause = DbViewFilter | DbFilterGroup;

export type LayoutKind = "table" | "kanban" | "calendar" | "graph" | "map";

export interface DbView {
  name: string;
  default?: boolean;
  sortCol?: string | null;
  sortDir?: "asc" | "desc";
  filters: DbViewFilter[];
  filterTree?: DbFilterClause;
  layout?: LayoutKind;
  kanbanGroupCol?: string;
  calendarDateCol?: string;
  calendarEndDateCol?: string;
}

// ── Entry ──────────────────────────────────────────────────────────

export interface DbEntry {
  title: string;
  relativePath: string;
  properties: Record<string, string>;
}

/** A directed link from one entry to another, derived from a markdown link. */
export interface DbEntryLink {
  source: string;
  target: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Type guard: true when the clause is a leaf (simple filter), not a group. */
export function isFilterLeaf(node: DbFilterClause): node is DbViewFilter {
  return !("logic" in node);
}
