import * as path from "path";
import * as fs from "fs";
import { Position, Uri, ViewColumn } from "../hostEditor/EditorTypes";
import type { TextDocument, WebviewPanel } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import {
  DbEntry,
  DbFilterClause,
  DbView,
  parseSchemaFromFile,
  parseViewsFromFile,
  readDbEntries,
  saveViewsToFile,
  updateEntryProperty,
  logEntryAndPromptNew,
} from "./database";
import { Cmd, Panel } from "../core/commands";
import { Regex } from "../core/regex";
import { ExtensionToDbPanelCommunicator } from "../communicators/dbPanelCommunicator";
import { IDbPanelInitPayload, DbEntryLink } from "../contracts/messages/dbPanelMessages";
import type { SlashCommand } from "../core/slashCommands";
import { cursorInDb } from "./dbEntries";

/** Wrapper to match SlashCommand handler signature */
async function handleOpenDbWebview(doc: TextDocument, _pos: Position): Promise<void> {
  await openDbWebview(doc.uri.fsPath);
}

export const VIEW_DATABASE_SLASH_COMMAND: SlashCommand = {
  label: "/view-database",
  insertText: "",
  detail: "\ud83d\udcca Open database webview",
  isAction: true,
  commandId: Cmd.openDbWebview,
  when: cursorInDb,
  dbOnly: true,
  kind: 21,
  handler: handleOpenDbWebview,
};

// ── Panel state ────────────────────────────────────────────────────

interface DbPanelState {
  panel: WebviewPanel;
  communicator: ExtensionToDbPanelCommunicator;
}

const panels = new Map<string, DbPanelState>();

// ── Open / refresh ─────────────────────────────────────────────────

export async function openDbWebview(dbIndexPath: string): Promise<void> {
  const existing = panels.get(dbIndexPath);
  if (existing) {
    existing.panel.reveal();
    await sendInit(existing.communicator, existing.panel, dbIndexPath);
    return;
  }

  const dbDir = path.dirname(dbIndexPath);
  const dbName = path.basename(dbDir);

  const panel = hostEditor.createWebviewPanel(Panel.dbView, `Database: ${dbName}`, "dbApp", ViewColumn.Active, {
    extraLocalResourceRoots: [Uri.file(dbDir), ...(hostEditor.getWorkspaceFolders() ?? []).map((f) => f.uri)],
  });

  const communicator = new ExtensionToDbPanelCommunicator(panel.webview);
  panels.set(dbIndexPath, { panel, communicator });

  panel.onDidDispose(() => panels.delete(dbIndexPath));
  const refreshPanel = async () => {
    await sendInit(communicator, panel, dbIndexPath);
  };

  // ── Register incoming message handlers ─────────────────────────

  communicator.registerOnReady(async () => {
    await refreshPanel();
  });

  communicator.registerOnOpenEntry(async (msg) => {
    const target = Uri.file(path.join(dbDir, msg.relativePath));
    await hostEditor.executeCommand("vscode.open", target);
  });

  communicator.registerOnAddEntry(async (msg) => {
    await hostEditor.executeCommand(Cmd.dbAddEntry, dbIndexPath, msg.defaults);
    await refreshPanel();
  });

  communicator.registerOnRefresh(async () => {
    await refreshPanel();
  });

  communicator.registerOnUpdateEntryProperty((msg) => {
    const entryFile = path.join(dbDir, msg.relativePath);
    updateEntryProperty(entryFile, msg.column, msg.value);
    softRefreshDbWebview(dbIndexPath);
  });

  communicator.registerOnPromptSaveView(async (msg) => {
    const name = await hostEditor.showInputBox({
      prompt: "Save view as",
      placeHolder: "My view",
      validateInput: (v) => (!v || v.trim().length === 0 ? "Name cannot be empty" : undefined),
    });
    if (!name) {
      return;
    }

    const makeDefault = await hostEditor.showQuickPick(
      [{ label: "Yes", description: "Set as default view" }, { label: "No" }],
      { placeHolder: "Set this view as default?" },
    );

    const views = parseViewsFromFile(dbIndexPath) || [];
    const payload: DbView = {
      name,
      default: makeDefault?.label === "Yes",
      sortCol: msg.state.sortCol,
      sortDir: msg.state.sortDir,
      filters: msg.state.filters ?? [],
      filterTree: msg.state.filterTree as DbFilterClause | undefined,
      layout: msg.state.layout,
      kanbanGroupCol: msg.state.kanbanGroupCol || undefined,
      calendarDateCol: msg.state.calendarDateCol || undefined,
      calendarEndDateCol: msg.state.calendarEndDateCol || undefined,
    };

    const updated = views.filter((v) => v.name !== name);
    updated.push(payload);
    if (payload.default) {
      updated.forEach((v) => {
        if (v !== payload) {
          v.default = false;
        }
      });
    }

    saveViewsToFile(dbIndexPath, updated);
    await refreshPanel();
  });

  communicator.registerOnShowWarning((msg) => {
    hostEditor.showWarning(msg.text);
  });

  communicator.registerOnShowDayEvents(async (msg) => {
    if (!msg.titles || msg.titles.length === 0) {
      return;
    }
    const pick = await hostEditor.showQuickPick(msg.titles, { placeHolder: `Entries on ${msg.date}` });
    if (pick) {
      const entry = readDbEntries(dbDir).find((e) => e.title === pick);
      if (entry) {
        const target = Uri.file(path.join(dbDir, entry.relativePath));
        await hostEditor.executeCommand("vscode.open", target);
      }
    }
  });

  communicator.registerOnLogEntry(async (msg) => {
    const schema = parseSchemaFromFile(dbIndexPath);
    if (!schema) {
      return;
    }
    const entryFile = path.join(dbDir, msg.relativePath);
    await logEntryAndPromptNew(entryFile, schema.columns);
    await refreshPanel();
  });

  // Send initial data; webview will request again via "ready" once mounted.
  await refreshPanel();
}

export function refreshDbWebview(dbIndexPath: string): void {
  const state = panels.get(dbIndexPath);
  if (state) {
    void sendInit(state.communicator, state.panel, dbIndexPath);
  }
}

export function softRefreshDbWebview(dbIndexPath: string): void {
  const state = panels.get(dbIndexPath);
  if (!state) {
    return;
  }
  const { entries } = resolveDbEntries(dbIndexPath);
  state.communicator.sendUpdateEntries(entries);
}

export function refreshAllDbWebviews(): void {
  panels.forEach(({ panel, communicator }, dbPath) => {
    if (panel.visible) {
      void sendInit(communicator, panel, dbPath);
    }
  });
}

// ── Helpers ────────────────────────────────────────────────────────

async function sendInit(
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
  const links = extractEntryLinks(dbDir, entries);
  const views = parseViewsFromFile(dbIndexPath) || [];

  // Resolve a webview-safe base URI so the webview can load images from .rsrc
  const wsRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri;
  const baseUri = wsRoot
    ? panel.webview.asWebviewUri(wsRoot).toString()
    : panel.webview.asWebviewUri(Uri.file(dbDir)).toString();
  const dbPayload: IDbPanelInitPayload = {
    schema: schema.columns,
    entries,
    links,
    views,
    titleFieldLabel: schema.titleField || "Title",
    dbName: path.basename(dbDir),
    baseUri,
  };
  communicator.sendInit(dbPayload);
}

function resolveDbEntries(dbIndexPath: string): { dbDir: string; entries: DbEntry[] } {
  const dbDir = path.dirname(dbIndexPath);
  const entries = mapEntries(readDbEntries(dbDir));
  return { dbDir, entries };
}

function mapEntries(entries: DbEntry[]): DbEntry[] {
  return entries.map((e) => ({
    title: e.title,
    relativePath: e.relativePath,
    properties: e.properties,
  }));
}

const LINK_RE = Regex.markdownLinkGlobal;

/**
 * Scan each entry's markdown for internal links that point to other entries
 * in the same database, and return them as directed edges.
 */
function extractEntryLinks(dbDir: string, entries: DbEntry[]): DbEntryLink[] {
  const entryPaths = new Set(entries.map((e) => e.relativePath));
  const links: DbEntryLink[] = [];

  for (const entry of entries) {
    const entryFile = path.join(dbDir, entry.relativePath);
    if (!fs.existsSync(entryFile)) continue;

    const content = fs.readFileSync(entryFile, "utf-8");
    const entryDir = path.dirname(entry.relativePath);

    let match: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;
    while ((match = LINK_RE.exec(content)) !== null) {
      const rawTarget = match[2];
      // Skip external links and anchors
      if (rawTarget.startsWith("http") || rawTarget.startsWith("#")) continue;

      // Resolve relative to entry directory, normalise separators
      const resolved = path.posix.normalize(path.posix.join(entryDir, rawTarget));
      if (entryPaths.has(resolved) && resolved !== entry.relativePath) {
        links.push({ source: entry.relativePath, target: resolved });
      }
    }
  }

  return links;
}
