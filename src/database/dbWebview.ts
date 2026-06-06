import * as path from "path";
import { Position, Uri, ViewColumn } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import {
  DbFilterClause,
  DbView,
  parseViewsFromFile,
  readDbEntries,
  saveViewsToFile,
  updateEntryProperty,
  logEntryAndPromptNew,
  parseSchemaFromFile,
  findParentDbIndex,
} from "./database";
import { validateColumnValue, validateUniqueness } from "./dbValidate";
import { Cmd, Panel } from "../core/commands";
import { Regex } from "../core/regex";
import { ExtensionToDbPanelCommunicator } from "../communicators/dbPanelCommunicator";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";
import { resolveDbEntries, resolveEntryPath, sendInit } from "./dbWebviewHelpers";

// ── Slash command ──────────────────────────────────────────────────

/** Wrapper to match SlashCommand handler signature — resolves parent DB index for child entries */
async function handleOpenDbWebview(doc: TextDocument, _pos: Position): Promise<void> {
  const fsPath = doc.uri.fsPath;
  const dbIndexPath = Regex.dbSchemaFenceStartMultiline.test(doc.getText()) ? fsPath : findParentDbIndex(fsPath);
  if (!dbIndexPath) {
    await hostEditor.showWarning("Lotion: This file is not part of a database.");
    return;
  }
  await openDbWebview(dbIndexPath);
}

export const VIEW_DATABASE_SLASH_COMMAND: SlashCommand = {
  label: "/view-database",
  insertText: "",
  detail: "📊 Open database webview",
  isAction: true,
  commandId: Cmd.openDbWebview,
  cmdFilter: Filter().pageIsDbIndexOrEntry(),
  kind: 21,
  handler: handleOpenDbWebview,
};

// ── Panel state ────────────────────────────────────────────────────

interface DbPanelState {
  panel: import("../hostEditor/EditorTypes").WebviewPanel;
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

  panel.onDidDispose(() => {
    const pending = refreshTimers.get(dbIndexPath);
    if (pending) {
      clearTimeout(pending);
      refreshTimers.delete(dbIndexPath);
    }
    panels.delete(dbIndexPath);
  });
  const refreshPanel = async () => {
    await sendInit(communicator, panel, dbIndexPath);
  };

  // ── Register incoming message handlers ─────────────────────────

  communicator.registerOnReady(async () => {
    await refreshPanel();
  });

  communicator.registerOnOpenEntry(async (msg) => {
    const resolved = resolveEntryPath(dbDir, msg.relativePath);
    if (!resolved) return;
    await hostEditor.executeCommand("vscode.open", Uri.file(resolved));
  });

  communicator.registerOnAddEntry(async (msg) => {
    await hostEditor.executeCommand(Cmd.dbAddEntry, dbIndexPath, msg.defaults);
    await refreshPanel();
  });

  communicator.registerOnRefresh(async () => {
    await refreshPanel();
  });

  communicator.registerOnUpdateEntryProperty((msg) => {
    const entryFile = resolveEntryPath(dbDir, msg.relativePath);
    if (!entryFile) return;

    // Validate against schema before committing — required, type, range,
    // option membership, uniqueness. On violation the write is skipped
    // and the user sees a warning; the panel refresh below restores the
    // cell to its on-disk value so the rejected input isn't kept.
    const schema = parseSchemaFromFile(dbIndexPath);
    const col = schema?.columns.find((c) => c.name === msg.column);
    if (col) {
      const cellError = validateColumnValue(col, msg.value);
      if (cellError) {
        hostEditor.showWarning(`Lotion: ${cellError}`);
        scheduleSoftRefresh(dbIndexPath);
        return;
      }
      if (col.unique) {
        const others = readDbEntries(dbDir)
          .filter((e) => e.relativePath !== msg.relativePath)
          .map((e) => e.properties[col.name] ?? "");
        const uniqueError = validateUniqueness(col, msg.value, others);
        if (uniqueError) {
          hostEditor.showWarning(`Lotion: ${uniqueError}`);
          scheduleSoftRefresh(dbIndexPath);
          return;
        }
      }
    }

    updateEntryProperty(entryFile, msg.column, msg.value);
    scheduleSoftRefresh(dbIndexPath);
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
        const resolved = resolveEntryPath(dbDir, entry.relativePath);
        if (!resolved) return;
        await hostEditor.executeCommand("vscode.open", Uri.file(resolved));
      }
    }
  });

  communicator.registerOnLogEntry(async (msg) => {
    const schema = parseSchemaFromFile(dbIndexPath);
    if (!schema) {
      return;
    }
    const entryFile = resolveEntryPath(dbDir, msg.relativePath);
    if (!entryFile) return;
    await logEntryAndPromptNew(entryFile, schema.columns);
    await refreshPanel();
  });

  communicator.registerOnCopyToClipboard(async (msg) => {
    if (typeof msg.text !== "string" || msg.text.length === 0) return;
    await hostEditor.writeClipboardText(msg.text);
    await hostEditor.showInformation(`Copied ${msg.label ?? "to clipboard"}.`);
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

// ── Coalesced refresh ──────────────────────────────────────────────
//
// `softRefreshDbWebview` re-reads the entire DB folder. For a bulk-edit
// of 50 rows, that's 50 disk scans + 50 webview messages back-to-back —
// a visible stutter. `scheduleSoftRefresh` collapses calls fired within
// a 50ms window into a single refresh at the trailing edge. Callers
// that want an immediate refresh (e.g. the initial panel ready handler)
// still use `softRefreshDbWebview` / `refreshDbWebview` directly.

const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSoftRefresh(dbIndexPath: string): void {
  const existing = refreshTimers.get(dbIndexPath);
  if (existing) clearTimeout(existing);
  refreshTimers.set(
    dbIndexPath,
    setTimeout(() => {
      refreshTimers.delete(dbIndexPath);
      softRefreshDbWebview(dbIndexPath);
    }, 50),
  );
}

export function refreshAllDbWebviews(): void {
  panels.forEach(({ panel, communicator }, dbPath) => {
    if (panel.visible) {
      void sendInit(communicator, panel, dbPath);
    }
  });
}
