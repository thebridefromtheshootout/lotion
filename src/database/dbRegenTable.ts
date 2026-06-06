import * as path from "path";
import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { DB_TABLE_MARKER_REGEX, formatMarkdownTable } from "../contracts/dbMarkdownTable";
import { parseSchemaFromFile } from "./dbSchema";
import { readDbEntries } from "./dbEntries";

// ── /regen-from-db handler ─────────────────────────────────────────
//
// Refreshes a DB-derived markdown table from its source database. The
// table must be prefixed by a `<!-- lotion-db-table source="..." -->`
// marker (emitted by the "Copy MD" toolbar button). Dataflow is
// one-way — this command never writes into the DB.

export interface MarkedTableRegion {
  /** Workspace-relative DB index path from the marker. */
  sourcePath: string;
  /** Line where the marker comment lives. */
  markerLine: number;
  /** Last line of the table (inclusive). May equal markerLine if no rows. */
  endLine: number;
}

/**
 * Locate a marked DB table at or near the cursor. We scan a small window
 * upward (the marker can sit on the line above, e.g. when the cursor lands
 * on the header row) so the command works from anywhere "inside" the table.
 */
export function findMarkedTableAround(document: TextDocument, cursorLine: number): MarkedTableRegion | undefined {
  const SCAN_BACK = 32; // generous — most DB exports are under 30 rows
  const start = Math.max(0, cursorLine - SCAN_BACK);

  let markerLine = -1;
  let sourcePath = "";
  for (let i = cursorLine; i >= start; i--) {
    const match = document.lineAt(i).text.match(DB_TABLE_MARKER_REGEX);
    if (match) {
      markerLine = i;
      sourcePath = match[1];
      break;
    }
  }
  if (markerLine === -1) return undefined;

  // Cursor must be in the same contiguous table block as the marker —
  // any blank or non-pipe line between them means the cursor is past
  // the table (not inside it).
  for (let i = markerLine + 1; i <= cursorLine; i++) {
    const line = document.lineAt(i).text;
    if (!line.startsWith("|")) {
      return undefined;
    }
  }

  // Walk forward from the marker to find the end of the table.
  let endLine = markerLine;
  for (let i = markerLine + 1; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;
    if (text.startsWith("|")) {
      endLine = i;
    } else if (text.trim().length === 0) {
      // Blank line = end of table block. Don't include in region.
      break;
    } else {
      break;
    }
  }

  return { sourcePath, markerLine, endLine };
}

/**
 * Resolve a workspace-relative path to an absolute fs path. Rejects
 * any path that escapes the workspace root.
 */
function resolveSourceDbPath(sourcePath: string): string | undefined {
  const wsRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!wsRoot) return undefined;

  const normalised = sourcePath.split(/[\\/]/).join(path.sep);
  const target = path.resolve(wsRoot, normalised);
  const rootAbs = path.resolve(wsRoot);
  if (target !== rootAbs && !target.startsWith(rootAbs + path.sep)) {
    return undefined;
  }
  return target;
}

export async function handleRegenFromDbCommand(document: TextDocument, position: Position): Promise<void> {
  const region = findMarkedTableAround(document, position.line);
  if (!region) {
    hostEditor.showWarning(
      'Lotion: place cursor on a markdown table prefixed by a `<!-- lotion-db-table source="..." -->` marker.',
    );
    return;
  }

  const dbIndexPath = resolveSourceDbPath(region.sourcePath);
  if (!dbIndexPath) {
    hostEditor.showError(`Lotion: cannot resolve source DB "${region.sourcePath}" against the workspace root.`);
    return;
  }

  const schema = parseSchemaFromFile(dbIndexPath);
  if (!schema) {
    hostEditor.showError(`Lotion: "${region.sourcePath}" is not a valid database (no schema fence).`);
    return;
  }

  const dbDir = path.dirname(dbIndexPath);
  const entries = readDbEntries(dbDir);
  const titleFieldLabel = schema.titleField || "Title";

  const headers = [titleFieldLabel, ...schema.columns.map((c) => c.name)];
  const rows = entries.map((e) => [e.title ?? "", ...schema.columns.map((c) => e.properties[c.name] ?? "")]);
  const fresh = formatMarkdownTable(headers, rows, region.sourcePath);

  const tableRange = new Range(
    new Position(region.markerLine, 0),
    new Position(region.endLine, document.lineAt(region.endLine).text.length),
  );
  await hostEditor.replaceRange(tableRange, fresh);
  await hostEditor.saveActiveDocument();
  hostEditor.showInformation(`Regenerated table from ${region.sourcePath} (${entries.length} rows).`);
}
