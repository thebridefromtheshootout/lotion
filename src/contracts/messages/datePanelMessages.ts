import type { IExtensionPanelMessage } from "../communicator";

// ── Outgoing (extension → webview) ─────────────────────────────────

export type DatePanelMessageOutType = "init" | "setTarget";

export interface IExtensionToDatePanelInitMessage extends IExtensionPanelMessage<"init"> {
  defaultFormat: string;
}

export interface IDatePanelSetTargetPayload {
  docUri: string;
  line: number;
  character: number;
  replaceEnd?: number;
  existingDate?: string;
}

export interface IExtensionToDatePanelSetTargetMessage
  extends IExtensionPanelMessage<"setTarget">, IDatePanelSetTargetPayload {}

export type IExtensionToDatePanelMessage = IExtensionToDatePanelInitMessage | IExtensionToDatePanelSetTargetMessage;
// ── Incoming (webview → extension) ─────────────────────────────────

export type DatePanelMessageInType = "ready" | "insertDate" | "close";

export interface IDatePanelReadyMessage extends IExtensionPanelMessage<"ready"> {}

export interface IDatePanelInsertDatePayload {
  docUri: string;
  line: number;
  character: number;
  formatted: string;
  format: string;
  replaceEnd?: number;
}

export interface IDatePanelInsertDateMessage
  extends IExtensionPanelMessage<"insertDate">, IDatePanelInsertDatePayload {}

export interface IDatePanelCloseMessage extends IExtensionPanelMessage<"close"> {}

export type IDatePanelToExtensionMessage =
  | IDatePanelReadyMessage
  | IDatePanelInsertDateMessage
  | IDatePanelCloseMessage;
