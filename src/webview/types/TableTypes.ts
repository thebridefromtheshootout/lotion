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
  /** Optimistic local update (replaces direct mutation of `entry.properties`). */
  onLocalEntryUpdate: (relPath: string, colName: string, newVal: string) => void;
  baseUri: string;
  /** Used to namespace persisted column widths in localStorage. */
  dbName: string;
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
