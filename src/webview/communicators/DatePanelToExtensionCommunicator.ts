import type {
  IExtensionToDatePanelMessage,
  IExtensionToDatePanelInitMessage,
  IExtensionToDatePanelSetTargetMessage,
  IDatePanelToExtensionMessage,
  IDatePanelInsertDatePayload,
} from "../../contracts/messages/datePanelMessages";
import { PanelToExtensionCommunicator } from "./PanelToExtensionCommunicator";

// MessageIn = what the extension sends TO us
// MessageOut = what we send TO the extension

export class DatePanelToExtensionCommunicator extends PanelToExtensionCommunicator<
  IExtensionToDatePanelMessage,
  IDatePanelToExtensionMessage
> {
  // ── Outgoing (panel → extension) ───────────────────────────────

  sendReady(): void {
    this.sendMessageOut({ type: "ready" });
  }

  sendInsertDate(payload: IDatePanelInsertDatePayload): void {
    this.sendMessageOut({ type: "insertDate", ...payload });
  }

  sendClose(): void {
    this.sendMessageOut({ type: "close" });
  }

  // ── Incoming (extension → panel) ───────────────────────────────

  registerOnInit(action: (msg: IExtensionToDatePanelInitMessage) => void): void {
    this.onMessageIn("init", action);
  }

  registerOnSetTarget(action: (msg: IExtensionToDatePanelSetTargetMessage) => void): void {
    this.onMessageIn("setTarget", action);
  }
}
