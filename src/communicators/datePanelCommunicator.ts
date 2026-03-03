import { ExtensionToPanelCommunicator } from "./extensionToPanelCommunicator";
import {
  IDatePanelToExtensionMessage,
  IExtensionToDatePanelMessage,
  IDatePanelSetTargetPayload,
  IDatePanelReadyMessage,
  IDatePanelInsertDateMessage,
  IDatePanelCloseMessage,
} from "../contracts/messages/datePanelMessages";

// ── Communicator ───────────────────────────────────────────────────

export class ExtensionToDatePanelCommunicator extends ExtensionToPanelCommunicator<
  IDatePanelToExtensionMessage,
  IExtensionToDatePanelMessage
> {
  sendInit(defaultFormat: string): Thenable<boolean> {
    return this.sendMessageOut({ type: "init", defaultFormat });
  }

  sendSetTarget(target: IDatePanelSetTargetPayload): Thenable<boolean> {
    return this.sendMessageOut({ type: "setTarget", ...target });
  }

  registerOnReady(action: (msg: IDatePanelReadyMessage) => void): void {
    this.onMessageIn("ready", action);
  }

  registerOnInsertDate(action: (msg: IDatePanelInsertDateMessage) => void): void {
    this.onMessageIn("insertDate", action);
  }

  registerOnClose(action: (msg: IDatePanelCloseMessage) => void): void {
    this.onMessageIn("close", action);
  }
}
