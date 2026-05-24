import * as path from "path";
import * as fs from "fs";
import { Uri } from "../hostEditor/EditorTypes";
import type { WebviewPanel } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { DbEntry, parseSchemaFromFile, parseViewsFromFile, readDbEntries } from "./database";
import { Regex } from "../core/regex";
import type { ExtensionToDbPanelCommunicator } from "../communicators/dbPanelCommunicator";
import type { IDbPanelInitPayload, DbEntryLink } from "../contracts/messages/dbPanelMessages";

// ── Initial webview payload ────────────────────────────────────────

export async function sendInit(
  communicator: ExtensionToDbPanelCommunicator,
  panel: WebviewPanel,
  dbIndexPath: string,
): Promise<void> {
  const schema = parseSchemaFromFile(dbIndexPath);
  if (!schema) {
    hostEditor.showError("Lotion: could not parse database schema.");
    return;
  }
  const { dbDir, entries } = resolveDbEntries(dbIndexPath);
  const links = await extractEntryLinks(dbDir, entries);
  const views = parseViewsFromFile(dbIndexPath) || [];

  // Resolve a webview-safe base URI so the webview can load images from .rsrc
  const wsRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri;
  const baseUri = wsRoot
    ? panel.webview.asWebviewUri(wsRoot).toString()
    : panel.webview.asWebviewUri(Uri.file(dbDir)).toString();
  // The DB index path relative to the workspace root, with forward slashes
  // so the same value works on Windows. Falls back to just the basename when
  // there's no workspace folder (rare — single-file open).
  const wsRootPath = wsRoot?.fsPath;
  const dbWorkspacePath = wsRootPath
    ? path.relative(wsRootPath, dbIndexPath).split(path.sep).join("/")
    : path.basename(dbIndexPath);

  const dbPayload: IDbPanelInitPayload = {
    schema: schema.columns,
    entries,
    links,
    views,
    titleFieldLabel: schema.titleField || "Title",
    dbName: path.basename(dbDir),
    baseUri,
    dbWorkspacePath,
  };
  communicator.sendInit(dbPayload);
}

// ── Entry resolution ───────────────────────────────────────────────

export function resolveDbEntries(dbIndexPath: string): { dbDir: string; entries: DbEntry[] } {
  const dbDir = path.dirname(dbIndexPath);
  const entries = mapEntries(readDbEntries(dbDir));
  return { dbDir, entries };
}

/**
 * Resolve a webview-supplied relative path against the database dir, rejecting any
 * value that escapes the directory (e.g. "../../../etc/passwd"). Returns the
 * absolute path on success, or undefined if the path traverses outside dbDir.
 */
export function resolveEntryPath(dbDir: string, relativePath: string): string | undefined {
  const dbDirAbs = path.resolve(dbDir);
  const target = path.resolve(dbDirAbs, relativePath);
  if (target !== dbDirAbs && !target.startsWith(dbDirAbs + path.sep)) {
    return undefined;
  }
  return target;
}

function mapEntries(entries: DbEntry[]): DbEntry[] {
  return entries.map((e) => ({
    title: e.title,
    relativePath: e.relativePath,
    properties: e.properties,
  }));
}

// ── Cross-entry link extraction ────────────────────────────────────

const LINK_RE = Regex.markdownLinkGlobal;

/**
 * Scan each entry's markdown for internal links that point to other entries
 * in the same database, and return them as directed edges.
 *
 * Reads run in parallel via fs.promises so a database with hundreds of
 * entries doesn't block the panel init on serial sync I/O. A single bad
 * file (deleted between fs.exists/read) is silently skipped.
 */
async function extractEntryLinks(dbDir: string, entries: DbEntry[]): Promise<DbEntryLink[]> {
  const entryPaths = new Set(entries.map((e) => e.relativePath));

  const perEntry = await Promise.all(
    entries.map(async (entry): Promise<DbEntryLink[]> => {
      const entryFile = path.join(dbDir, entry.relativePath);
      let content: string;
      try {
        content = await fs.promises.readFile(entryFile, "utf-8");
      } catch {
        // ENOENT / EISDIR / EACCES — skip this entry.
        return [];
      }
      const entryDir = path.dirname(entry.relativePath);
      const out: DbEntryLink[] = [];
      // Local regex with /g — using LINK_RE.lastIndex across parallel runs
      // would race; clone instead.
      const re = new RegExp(LINK_RE.source, LINK_RE.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        const rawTarget = match[2];
        if (rawTarget.startsWith("http") || rawTarget.startsWith("#")) continue;
        const resolved = path.posix.normalize(path.posix.join(entryDir, rawTarget));
        if (entryPaths.has(resolved) && resolved !== entry.relativePath) {
          out.push({ source: entry.relativePath, target: resolved });
        }
      }
      return out;
    }),
  );

  return perEntry.flat();
}
