import type { IExtensionPanelMessage } from "../communicator";
import type { DbColumn, DbEntry, DbView, DbViewFilter, DbFilterClause, DbEntryLink, LayoutKind } from "../databaseTypes";

// Re-export DbEntryLink so existing importers of this file still work
export type { DbEntryLink } from "../databaseTypes";

// ── Outgoing (extension → webview) ─────────────────────────────────

export interface IDbPanelInitPayload {
  schema: DbColumn[];
  entries: DbEntry[];
  views: DbView[];
  /** Edges between entries derived from internal markdown links. */
  links: DbEntryLink[];
  titleFieldLabel: string;
  dbName: string;
  /** Webview-safe base URI for resolving relative image paths. */
  baseUri: string;
}

export interface IExtensionToDbPanelInitMessage extends IExtensionPanelMessage<"init">, IDbPanelInitPayload {}

export interface IExtensionToDbPanelUpdateEntriesMessage extends IExtensionPanelMessage<"updateEntries"> {
  entries: DbEntry[];
}

export type IExtensionToDbPanelMessage = IExtensionToDbPanelInitMessage | IExtensionToDbPanelUpdateEntriesMessage;
// ── Incoming (webview → extension) ─────────────────────────────────

export interface IDbPanelReadyMessage extends IExtensionPanelMessage<"ready"> {}

export interface IDbPanelOpenEntryMessage extends IExtensionPanelMessage<"openEntry"> {
  relativePath: string;
}

export interface IDbPanelAddEntryMessage extends IExtensionPanelMessage<"addEntry"> {
  /** Pre-filled column values — prompted columns with a default are skipped. */
  defaults?: Record<string, string>;
}

export interface IDbPanelRefreshMessage extends IExtensionPanelMessage<"refresh"> {}

export interface IDbPanelUpdateEntryPropertyMessage extends IExtensionPanelMessage<"updateEntryProperty"> {
  relativePath: string;
  column: string;
  value: string;
}

export interface IDbViewState {
  sortCol?: string | null;
  sortDir?: "asc" | "desc";
  filters: DbViewFilter[];
  filterTree?: DbFilterClause;
  layout?: LayoutKind;
  kanbanGroupCol?: string;
  calendarDateCol?: string;
  calendarEndDateCol?: string;
}

export interface IDbPanelPromptSaveViewMessage extends IExtensionPanelMessage<"promptSaveView"> {
  state: IDbViewState;
}

export interface IDbPanelShowWarningMessage extends IExtensionPanelMessage<"showWarning"> {
  text: string;
}

export interface IDbPanelShowDayEventsMessage extends IExtensionPanelMessage<"showDayEvents"> {
  date: string;
  titles: string[];
}

export interface IDbPanelLogEntryMessage extends IExtensionPanelMessage<"logEntry"> {
  relativePath: string;
}

export type IDbPanelToExtensionMessage =
  | IDbPanelReadyMessage
  | IDbPanelOpenEntryMessage
  | IDbPanelAddEntryMessage
  | IDbPanelRefreshMessage
  | IDbPanelUpdateEntryPropertyMessage
  | IDbPanelPromptSaveViewMessage
  | IDbPanelShowWarningMessage
  | IDbPanelShowDayEventsMessage
  | IDbPanelLogEntryMessage;
