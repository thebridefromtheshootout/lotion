import { DbColumn, DbEntryData } from "./SharedTypes";
import { DbPanelToExtensionCommunicator } from "../communicators/DbPanelToExtensionCommunicator";

export type commitEditMethodType = (relPath: string, colName: string, newVal: string) => void;

export interface TableViewProps {
  entries: DbEntryData[];
  schema: DbColumn[];
  titleFieldLabel: string;
  sortCol: string | null;
  sortDir: "asc" | "desc";
  onToggleSort: (col: string) => void;
  baseUri: string;
  communicator: DbPanelToExtensionCommunicator;
}

export interface InlineEditorProps {
  colType: string;
  currentVal: string;
  options: string[];
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export interface FormatCellProps {
  value: string;
  type: string;
  baseUri?: string;
  maxWidth?: number;
  maxHeight?: number;
}
