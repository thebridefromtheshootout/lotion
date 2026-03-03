import type { IExtensionPanelMessage } from "../communicator";

// ── Outgoing (extension → webview) ─────────────────────────────────

export interface IExtensionToDictatePanelResultMessage extends IExtensionPanelMessage<"result"> {
  partial: string;
  accumulated: string;
}

export interface IExtensionToDictatePanelErrorMessage extends IExtensionPanelMessage<"error"> {
  message: string;
}

export interface IExtensionToDictatePanelInsertedMessage extends IExtensionPanelMessage<"inserted"> {}

export interface IExtensionToDictatePanelSetTargetMessage extends IExtensionPanelMessage<"setTarget"> {
  docUri: string;
  line: number;
  character: number;
}

export type IExtensionToDictatePanelMessage =
  | IExtensionToDictatePanelResultMessage
  | IExtensionToDictatePanelErrorMessage
  | IExtensionToDictatePanelInsertedMessage
  | IExtensionToDictatePanelSetTargetMessage;

// ── Incoming (webview → extension) ─────────────────────────────────

export interface IDictatePanelAudioDataMessage extends IExtensionPanelMessage<"audioData"> {
  samples: number[];
}

export interface IDictatePanelStopMessage extends IExtensionPanelMessage<"stop"> {}

export interface IDictatePanelInsertMessage extends IExtensionPanelMessage<"insert"> {
  text: string;
}

export interface IDictatePanelClearMessage extends IExtensionPanelMessage<"clear"> {}

export type IDictatePanelToExtensionMessage =
  | IDictatePanelAudioDataMessage
  | IDictatePanelStopMessage
  | IDictatePanelInsertMessage
  | IDictatePanelClearMessage;
