// ── Types shared between extension host and webview ────────────────
// Canonical definitions live in contracts/databaseTypes.ts.
// This file re-exports them (with webview-era aliases) for backward compat.

export type {
  DbColumn,
  DbSchema,
  DbFilterOperator,
  DbViewFilter,
  DbFilterClause,
  DbView,
  DbEntry,
  DbEntryLink,
  LayoutKind,
} from "../../contracts/databaseTypes";

export { isFilterLeaf } from "../../contracts/databaseTypes";

// Legacy aliases used throughout the webview layer
import type {
  DbEntry,
  DbView,
  DbViewFilter,
  DbFilterClause,
  DbFilterOperator,
} from "../../contracts/databaseTypes";

/** @deprecated Use `DbEntry` */
export type DbEntryData = DbEntry;

/** @deprecated Use `DbView` */
export type DbViewData = DbView;

/** @deprecated Use `DbViewFilter` */
export type FilterLeaf = DbViewFilter;

/** @deprecated Use the group branch of `DbFilterClause` */
export interface FilterGroup {
  logic: "AND" | "OR";
  clauses: FilterNode[];
  not?: boolean;
}

/** @deprecated Use `DbFilterClause` */
export type FilterNode = DbFilterClause;

/** @deprecated Use `isFilterLeaf` */
import { isFilterLeaf } from "../../contracts/databaseTypes";
export function isLeaf(node: DbFilterClause): node is DbViewFilter {
  return isFilterLeaf(node);
}
