import { DbColumn, DbViewData, LayoutKind } from "./SharedTypes";
import { DbPanelToExtensionCommunicator } from "../communicators/DbPanelToExtensionCommunicator";

export interface ToolbarProps {
  layout: LayoutKind;
  setLayout: (l: LayoutKind) => void;
  schema: DbColumn[];
  views: DbViewData[];
  onLoadView: (name: string) => void;
  onSaveView: () => void;
  communicator: DbPanelToExtensionCommunicator;
}
