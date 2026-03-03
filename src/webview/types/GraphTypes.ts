import { DbEntryData } from "./SharedTypes";
import { DbPanelToExtensionCommunicator } from "../communicators/DbPanelToExtensionCommunicator";

export interface GraphLink {
  source: string; // relativePath
  target: string; // relativePath
}

export interface GraphViewProps {
  entries: DbEntryData[];
  links: GraphLink[];
  communicator: DbPanelToExtensionCommunicator;
}
