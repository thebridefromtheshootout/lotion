// ── JSON → tabular data helper ─────────────────────────────────────
//
// Parses a JSON document (array of objects) into the same
// `{ headers, rows }` shape `createDatabaseFromTabularData` expects.
//
// Supported shapes:
//   - [{ k: v, ... }, ...]   — preferred: each object is a row, keys union → headers
//   - [primitive, ...]        — single "value" column
//
// All cell values are stringified — nested objects/arrays become JSON
// strings, booleans become "true" / "false", null becomes "".

export interface JsonTabular {
  headers: string[];
  rows: string[][];
}

export class JsonImportError extends Error {}

export function parseJsonToTabular(text: string): JsonTabular {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new JsonImportError(`Invalid JSON: ${(e as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new JsonImportError("JSON must be an array of objects.");
  }
  if (parsed.length === 0) {
    return { headers: [], rows: [] };
  }

  // Primitive-array shape: single "value" column.
  if (parsed.every((row) => typeof row !== "object" || row === null)) {
    return {
      headers: ["value"],
      rows: parsed.map((v) => [stringifyCell(v)]),
    };
  }

  // Object-array shape: collect the union of keys in first-seen order.
  const seen = new Set<string>();
  const headers: string[] = [];
  for (const row of parsed) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new JsonImportError("Every element must be an object (mixed arrays are not supported).");
    }
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  const rows: string[][] = parsed.map((row) => {
    const obj = row as Record<string, unknown>;
    return headers.map((h) => stringifyCell(obj[h]));
  });

  return { headers, rows };
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  // Objects / arrays — stringify so the cell stays a string; users can split
  // into proper columns later.
  return JSON.stringify(value);
}
