import type {
  IExtensionToDbPanelMessage,
  IExtensionToDbPanelInitMessage,
  IExtensionToDbPanelUpdateEntriesMessage,
  IDbPanelToExtensionMessage,
  IDbPanelPromptSaveViewMessage,
  IDbViewState,
} from "../../contracts/messages/dbPanelMessages";
import { PanelToExtensionCommunicator } from "./PanelToExtensionCommunicator";

// MessageIn = what the extension sends TO us
// MessageOut = what we send TO the extension

export class DbPanelToExtensionCommunicator extends PanelToExtensionCommunicator<
  IExtensionToDbPanelMessage,
  IDbPanelToExtensionMessage
> {
  // ── Outgoing (panel → extension) ───────────────────────────────

  sendReady(): void {
    this.sendMessageOut({ type: "ready" });
  }

  sendOpenEntry(relativePath: string): void {
    this.sendMessageOut({ type: "openEntry", relativePath });
  }

  sendAddEntry(defaults?: Record<string, string>): void {
    this.sendMessageOut({ type: "addEntry", defaults });
  }

  sendRefresh(): void {
    this.sendMessageOut({ type: "refresh" });
  }

  sendUpdateEntryProperty(relativePath: string, column: string, value: string): void {
    this.sendMessageOut({ type: "updateEntryProperty", relativePath, column, value });
  }

  sendPromptSaveView(state: IDbViewState): void {
    this.sendMessageOut({ type: "promptSaveView", state } as IDbPanelPromptSaveViewMessage);
  }

  sendShowWarning(text: string): void {
    this.sendMessageOut({ type: "showWarning", text });
  }

  sendShowDayEvents(date: string, titles: string[]): void {
    this.sendMessageOut({ type: "showDayEvents", date, titles });
  }

  sendLogEntry(relativePath: string): void {
    this.sendMessageOut({ type: "logEntry", relativePath });
  }

  // ── Incoming (extension → panel) ───────────────────────────────

  registerOnInit(action: (msg: IExtensionToDbPanelInitMessage) => void): void {
    this.onMessageIn("init", action);
  }

  registerOnUpdateEntries(action: (msg: IExtensionToDbPanelUpdateEntriesMessage) => void): void {
    this.onMessageIn("updateEntries", action);
  }
}
