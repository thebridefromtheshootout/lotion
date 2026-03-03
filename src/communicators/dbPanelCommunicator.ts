import type { DbEntry } from "../contracts/databaseTypes";
import { ExtensionToPanelCommunicator } from "./extensionToPanelCommunicator";
import {
  IDbPanelToExtensionMessage,
  IExtensionToDbPanelMessage,
  IDbPanelInitPayload,
  IDbPanelReadyMessage,
  IDbPanelOpenEntryMessage,
  IDbPanelAddEntryMessage,
  IDbPanelRefreshMessage,
  IDbPanelUpdateEntryPropertyMessage,
  IDbPanelPromptSaveViewMessage,
  IDbPanelShowWarningMessage,
  IDbPanelShowDayEventsMessage,
  IDbPanelLogEntryMessage,
} from "../contracts/messages/dbPanelMessages";

// ── Communicator ───────────────────────────────────────────────────

export class ExtensionToDbPanelCommunicator extends ExtensionToPanelCommunicator<
  IDbPanelToExtensionMessage,
  IExtensionToDbPanelMessage
> {
  // ── Outgoing (extension → webview) ───────────────────────────

  sendInit(payload: IDbPanelInitPayload): Thenable<boolean> {
    return this.sendMessageOut({ type: "init", ...payload });
  }

  sendUpdateEntries(entries: DbEntry[]): Thenable<boolean> {
    return this.sendMessageOut({ type: "updateEntries", entries });
  }

  // ── Incoming (webview → extension) ───────────────────────────

  registerOnReady(action: (msg: IDbPanelReadyMessage) => void): void {
    this.onMessageIn("ready", action);
  }

  registerOnOpenEntry(action: (msg: IDbPanelOpenEntryMessage) => void): void {
    this.onMessageIn("openEntry", action);
  }

  registerOnAddEntry(action: (msg: IDbPanelAddEntryMessage) => void): void {
    this.onMessageIn("addEntry", action);
  }

  registerOnRefresh(action: (msg: IDbPanelRefreshMessage) => void): void {
    this.onMessageIn("refresh", action);
  }

  registerOnUpdateEntryProperty(action: (msg: IDbPanelUpdateEntryPropertyMessage) => void): void {
    this.onMessageIn("updateEntryProperty", action);
  }

  registerOnPromptSaveView(action: (msg: IDbPanelPromptSaveViewMessage) => void): void {
    this.onMessageIn("promptSaveView", action);
  }

  registerOnShowWarning(action: (msg: IDbPanelShowWarningMessage) => void): void {
    this.onMessageIn("showWarning", action);
  }

  registerOnShowDayEvents(action: (msg: IDbPanelShowDayEventsMessage) => void): void {
    this.onMessageIn("showDayEvents", action);
  }

  registerOnLogEntry(action: (msg: IDbPanelLogEntryMessage) => void): void {
    this.onMessageIn("logEntry", action);
  }
}
