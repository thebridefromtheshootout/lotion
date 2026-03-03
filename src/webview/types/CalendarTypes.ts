import { DbColumn, DbEntryData } from "./SharedTypes";
import { DbPanelToExtensionCommunicator } from "../communicators/DbPanelToExtensionCommunicator";

export interface CalendarViewProps {
  entries: DbEntryData[];
  schema: DbColumn[];
  calendarDateCol: string;
  calendarEndDateCol: string | undefined;
  onCalendarDateColChange: (col: string) => void;
  onCalendarEndDateColChange: (col: string | undefined) => void;
  communicator: DbPanelToExtensionCommunicator;
}

export interface CalEvent {
  title: string;
  start: Date;
  end: Date;
  relativePath: string;
  isRange: boolean;
}

export interface IWeekProfile {
  weekIndex: number;
  weekCells: CellData[];
  spacerH: number;
  assignments: Assignment[];
}
export interface IMonthProfile {
numWeeks: number;
cells: CellData[];
}

export interface CellData {
  date: Date;
  str: string;
  other: boolean;
  isToday: boolean;
}

export interface Assignment {
  we: WeekEvent;
  slot: number;
}
export interface WeekEvent {
  ev: CalEvent;
  startCol: number;
  endCol: number;
  span: number;
  contLeft: boolean;
  contRight: boolean;
  isMultiDay: boolean;
}
