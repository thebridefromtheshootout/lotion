import { ExtensionToPanelCommunicator } from "./extensionToPanelCommunicator";
import type {
  IDictatePanelToExtensionMessage,
  IExtensionToDictatePanelMessage,
  IDictatePanelAudioDataMessage,
  IDictatePanelStopMessage,
  IDictatePanelInsertMessage,
  IDictatePanelClearMessage,
} from "../contracts/messages/dictatePanelMessages";

// ── Communicator ───────────────────────────────────────────────────

export class ExtensionToDictatePanelCommunicator extends ExtensionToPanelCommunicator<
  IDictatePanelToExtensionMessage,
  IExtensionToDictatePanelMessage
> {
  // ── Outgoing (extension → webview) ───────────────────────────

  sendResult(partial: string, accumulated: string): Thenable<boolean> {
    return this.sendMessageOut({ type: "result", partial, accumulated });
  }

  sendError(message: string): Thenable<boolean> {
    return this.sendMessageOut({ type: "error", message });
  }

  sendInserted(): Thenable<boolean> {
    return this.sendMessageOut({ type: "inserted" });
  }

  sendSetTarget(docUri: string, line: number, character: number): Thenable<boolean> {
    return this.sendMessageOut({ type: "setTarget", docUri, line, character });
  }

  // ── Incoming (webview → extension) ───────────────────────────

  registerOnAudioData(action: (msg: IDictatePanelAudioDataMessage) => void): void {
    this.onMessageIn("audioData", action);
  }

  registerOnStop(action: (msg: IDictatePanelStopMessage) => void): void {
    this.onMessageIn("stop", action);
  }

  registerOnInsert(action: (msg: IDictatePanelInsertMessage) => void): void {
    this.onMessageIn("insert", action);
  }

  registerOnClear(action: (msg: IDictatePanelClearMessage) => void): void {
    this.onMessageIn("clear", action);
  }
}
