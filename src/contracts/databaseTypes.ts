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

export interface DbViewFilter {
  col: string;
  op: DbFilterOperator;
  value: string;
}

/**
 * A compound filter clause supports nested AND / OR grouping.
 *
 * - A **leaf** clause is a simple `DbViewFilter` (`{ col, op, value }`).
 * - A **group** clause combines children with a logical operator:
 *   `{ logic: "AND"|"OR", clauses: [...], not?: true }`.
 */
export type DbFilterClause = DbViewFilter | { logic: "AND" | "OR"; clauses: DbFilterClause[]; not?: boolean };

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
  return (node as any).logic === undefined && (node as any).col !== undefined;
}
