import { FilterNode, FilterLeaf, FilterGroup, isLeaf } from "../types";

// ── Filter evaluation ──────────────────────────────────────────────

export function matchesFilters(
  entry: { title: string; properties: Record<string, string> },
  filterTree: FilterGroup,
): boolean {
  if (filterTree.clauses.length === 0) return true;
  return evalClause(filterTree, entry);
}

function evalClause(node: FilterNode, entry: { title: string; properties: Record<string, string> }): boolean {
  if (isLeaf(node)) {
    const target = node.col === "__title" ? entry.title : entry.properties[node.col] || "";
    return evalFilter(target, node.op, node.value);
  }
  const group = node as FilterGroup;
  let result: boolean;
  if (group.clauses.length === 0) {
    result = true;
  } else if (group.logic === "AND") {
    result = group.clauses.every((c) => evalClause(c, entry));
  } else {
    result = group.clauses.some((c) => evalClause(c, entry));
  }
  return group.not ? !result : result;
}

function evalFilter(target: string, op: string, value: string): boolean {
  const t = target.toLowerCase();
  const v = value.toLowerCase();
  switch (op) {
    case "==":
      return t === v;
    case "!=":
      return t !== v;
    case "contains":
      return t.includes(v);
    case "!contains":
      return !t.includes(v);
    case "startswith":
      return t.startsWith(v);
    case "!startswith":
      return !t.startsWith(v);
    case "endswith":
      return t.endsWith(v);
    case "!endswith":
      return !t.endsWith(v);
    case "matches_regex":
      try {
        return new RegExp(value, "i").test(target);
      } catch {
        return false;
      }
    case ">":
    case ">=":
    case "<":
    case "<=":
      return compareNumeric(target, op, value);
    case "between": {
      const parts = value.split(",").map((s) => s.trim());
      if (parts.length !== 2) return false;
      return compareNumeric(target, ">=", parts[0]) && compareNumeric(target, "<=", parts[1]);
    }
    case "in":
      return splitLowerCsv(value).includes(t);
    case "!in":
      return !splitLowerCsv(value).includes(t);
    case "has_any": {
      const targetVals = splitLowerCsv(target);
      const filterVals = splitLowerCsv(value);
      return filterVals.some((fv) => targetVals.includes(fv));
    }
    case "has_all": {
      const targetVals = splitLowerCsv(target);
      const filterVals = splitLowerCsv(value);
      return filterVals.every((fv) => targetVals.includes(fv));
    }
    case "isempty":
      return target.trim() === "";
    case "isnotempty":
      return target.trim() !== "";
    default:
      return t.includes(v);
  }
}

function splitLowerCsv(value: string): string[] {
  return value.split(",").map((part) => part.trim().toLowerCase());
}

function compareNumeric(target: string, op: string, value: string): boolean {
  const a = Number(target);
  const b = Number(value);
  if (!isNaN(a) && !isNaN(b)) {
    switch (op) {
      case ">":
        return a > b;
      case ">=":
        return a >= b;
      case "<":
        return a < b;
      case "<=":
        return a <= b;
    }
  }
  const ta = target.toLowerCase();
  const tv = value.toLowerCase();
  switch (op) {
    case ">":
      return ta > tv;
    case ">=":
      return ta >= tv;
    case "<":
      return ta < tv;
    case "<=":
      return ta <= tv;
  }
  return false;
}

// ── Sorting ─────────────────────────────────────────────────────────

export function compareFn(
  sortCol: string,
  sortDir: "asc" | "desc",
): (
  a: { title: string; properties: Record<string, string> },
  b: { title: string; properties: Record<string, string> },
) => number {
  return (a, b) => {
    let va: string, vb: string;
    if (sortCol === "__title") {
      va = a.title.toLowerCase();
      vb = b.title.toLowerCase();
    } else {
      va = (a.properties[sortCol] || "").toLowerCase();
      vb = (b.properties[sortCol] || "").toLowerCase();
    }
    const na = Number(va),
      nb = Number(vb);
    if (!isNaN(na) && !isNaN(nb)) {
      return sortDir === "asc" ? na - nb : nb - na;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  };
}

// ── Filter tree manipulation ────────────────────────────────────────

export function pruneEmptyGroups(node: FilterNode): void {
  if (isLeaf(node)) return;
  const group = node as FilterGroup;
  group.clauses = group.clauses.filter((c) => {
    if (isLeaf(c)) return true;
    pruneEmptyGroups(c);
    return (c as FilterGroup).clauses.length > 0;
  });
}
