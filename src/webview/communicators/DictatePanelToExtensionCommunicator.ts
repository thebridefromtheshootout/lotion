import type {
  IExtensionToDictatePanelMessage,
  IExtensionToDictatePanelResultMessage,
  IExtensionToDictatePanelErrorMessage,
  IExtensionToDictatePanelInsertedMessage,
  IExtensionToDictatePanelSetTargetMessage,
  IDictatePanelToExtensionMessage,
} from "../../contracts/messages/dictatePanelMessages";
import { PanelToExtensionCommunicator } from "./PanelToExtensionCommunicator";

// MessageIn = what the extension sends TO us
// MessageOut = what we send TO the extension

export class DictatePanelToExtensionCommunicator extends PanelToExtensionCommunicator<
  IExtensionToDictatePanelMessage,
  IDictatePanelToExtensionMessage
> {
  // ── Outgoing (panel → extension) ───────────────────────────────

  sendAudioData(samples: number[]): void {
    this.sendMessageOut({ type: "audioData", samples });
  }

  sendStop(): void {
    this.sendMessageOut({ type: "stop" });
  }

  sendInsert(text: string): void {
    this.sendMessageOut({ type: "insert", text });
  }

  sendClear(): void {
    this.sendMessageOut({ type: "clear" });
  }

  // ── Incoming (extension → panel) ───────────────────────────────

  registerOnResult(action: (msg: IExtensionToDictatePanelResultMessage) => void): void {
    this.onMessageIn("result", action);
  }

  registerOnError(action: (msg: IExtensionToDictatePanelErrorMessage) => void): void {
    this.onMessageIn("error", action);
  }

  registerOnInserted(action: (msg: IExtensionToDictatePanelInsertedMessage) => void): void {
    this.onMessageIn("inserted", action);
  }

  registerOnSetTarget(action: (msg: IExtensionToDictatePanelSetTargetMessage) => void): void {
    this.onMessageIn("setTarget", action);
  }
}
