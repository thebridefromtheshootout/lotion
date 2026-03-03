import { DbColumn, DbEntryData } from "./SharedTypes";
import { DbPanelToExtensionCommunicator } from "../communicators/DbPanelToExtensionCommunicator";

export interface KanbanViewProps {
  entries: DbEntryData[];
  schema: DbColumn[];
  kanbanGroupCol: string;
  onKanbanGroupColChange: (col: string) => void;
  baseUri: string;
  communicator: DbPanelToExtensionCommunicator;
}
