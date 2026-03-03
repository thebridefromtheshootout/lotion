import { DbEntryData } from "./SharedTypes";
import { DbPanelToExtensionCommunicator } from "../communicators/DbPanelToExtensionCommunicator";
import type { DbColumn } from "../../contracts/databaseTypes";

export interface MapViewProps {
  entries: DbEntryData[];
  schema: DbColumn[];
  communicator: DbPanelToExtensionCommunicator;
}
