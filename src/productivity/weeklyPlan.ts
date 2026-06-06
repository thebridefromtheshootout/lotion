import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

// ── Date helpers ────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmt(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function yearMondays(year: number): Date[] {
  const mondays: Date[] = [];
  const d = new Date(year, 0, 1);
  d.setHours(0, 0, 0, 0);
  // Advance to first Monday
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow));
  while (d.getFullYear() === year) {
    mondays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return mondays;
}

// ── Template ────────────────────────────────────────────────────────

function weekTemplate(monday: Date): string {
  const friday = addDays(monday, 4);
  const lines: string[] = [`## Week of (${fmt(monday)} – ${fmt(friday)})`, ""];
  for (let i = 0; i < 5; i++) {
    const day = addDays(monday, i);
    lines.push(`### ${DAY_NAMES[day.getDay()]}, ${fmt(day)}`);
    lines.push("- [ ] ");
    lines.push("");
  }
  return lines.join("\n");
}

// ── Insert helper ───────────────────────────────────────────────────

async function insertTemplate(doc: TextDocument, pos: Position, text: string): Promise<void> {
  const lineText = doc.lineAt(pos.line).text;
  if (lineText.trim().length === 0) {
    await hostEditor.replaceRange(new Range(new Position(pos.line, 0), new Position(pos.line, lineText.length)), text);
  } else {
    await hostEditor.insertAt(new Position(pos.line + 1, 0), text + "\n");
  }
}

// ── /plan-this-week ─────────────────────────────────────────────────

export async function handlePlanThisWeek(doc: TextDocument, pos: Position): Promise<void> {
  await insertTemplate(doc, pos, weekTemplate(getMondayOf(new Date())));
}

// ── /plan-week-of ───────────────────────────────────────────────────

export async function handlePlanWeekOf(doc: TextDocument, pos: Position): Promise<void> {
  const today = new Date();
  const items = yearMondays(today.getFullYear()).map((monday) => {
    const friday = addDays(monday, 4);
    return { label: `${fmt(monday)} – ${fmt(friday)}`, monday };
  });

  const pick = await hostEditor.showQuickPick(
    items.map((it) => ({ label: it.label })),
    { placeHolder: "Select a week" },
  );
  if (!pick) return;

  const chosen = items.find((it) => it.label === pick.label)!;
  await hostEditor.showTextDocument(doc);
  await insertTemplate(doc, pos, weekTemplate(chosen.monday));
}

// ── Cursor detection ────────────────────────────────────────────────

const WEEK_HEADER_RE = /^## Week of \(/;
const DAY_HEADING_RE = /^### (Monday|Tuesday|Wednesday|Thursday|Friday), /;
const H2_RE = /^## /;
const H3_RE = /^### /;

export function cursorInWeekBlock(doc: TextDocument, pos: Position): boolean {
  for (let i = pos.line; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    if (WEEK_HEADER_RE.test(text)) return true;
    if (i < pos.line && H2_RE.test(text)) return false;
  }
  return false;
}

export function cursorInWeekDaySection(doc: TextDocument, pos: Position): boolean {
  if (!cursorInWeekBlock(doc, pos)) return false;
  for (let i = pos.line; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    if (DAY_HEADING_RE.test(text)) return true;
    if (i < pos.line && (H3_RE.test(text) || WEEK_HEADER_RE.test(text))) return false;
  }
  return false;
}

// ── /carry-forward ──────────────────────────────────────────────────

export async function handleCarryForward(doc: TextDocument, pos: Position): Promise<void> {
  const lineCount = doc.lineCount;

  // Find the ### heading for the current day section
  let currentDayLine = -1;
  for (let i = pos.line; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    if (DAY_HEADING_RE.test(text)) {
      currentDayLine = i;
      break;
    }
    if (WEEK_HEADER_RE.test(text)) break;
  }
  if (currentDayLine === -1) return;

  // Find where this section ends and where the next day heading is
  let sectionEnd = lineCount;
  let nextDayLine = -1;
  for (let i = currentDayLine + 1; i < lineCount; i++) {
    const text = doc.lineAt(i).text;
    if (H3_RE.test(text) || H2_RE.test(text)) {
      sectionEnd = i;
      if (DAY_HEADING_RE.test(text)) nextDayLine = i;
      break;
    }
  }

  if (nextDayLine === -1) {
    hostEditor.showWarning("Lotion: No next day — this is the last day in the week.");
    return;
  }

  // Collect unchecked tasks within the current section
  const UNCHECKED_RE = /^\s*- \[ \] /;
  const toMove: { line: number; text: string }[] = [];
  for (let i = currentDayLine + 1; i < sectionEnd; i++) {
    if (UNCHECKED_RE.test(doc.lineAt(i).text)) {
      toMove.push({ line: i, text: doc.lineAt(i).text });
    }
  }

  if (toMove.length === 0) {
    hostEditor.showWarning("Lotion: No unfinished tasks to carry forward.");
    return;
  }

  // Insert tasks after the next day heading, delete from current section.
  // All ranges reference original document positions — editor.edit() is atomic.
  const insertText = toMove.map((t) => t.text).join("\n") + "\n";
  const insertPos = new Position(nextDayLine + 1, 0);

  const deleteEdits = toMove
    .slice()
    .reverse()
    .map(({ line }) => ({
      range: new Range(new Position(line, 0), new Position(line + 1, 0)),
      text: "",
    }));

  await hostEditor.batchReplaceRanges([{ range: new Range(insertPos, insertPos), text: insertText }, ...deleteEdits]);
}

// ── Slash commands ──────────────────────────────────────────────────

export const PRODUCTIVITY_SLASH_COMMANDS: SlashCommand[] = [
  {
    label: "/plan-this-week",
    insertText: "",
    detail: "📅 Insert weekly plan for the current week",
    isAction: true,
    commandId: Cmd.planThisWeek,
    kind: 14,
    handler: handlePlanThisWeek,
    cleanLine: true,
    cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  },
  {
    label: "/plan-week-of",
    insertText: "",
    detail: "📅 Insert weekly plan — pick a week",
    isAction: true,
    commandId: Cmd.planWeekOf,
    kind: 14,
    handler: handlePlanWeekOf,
    cleanLine: true,
    cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  },
  {
    label: "/carry-forward",
    insertText: "",
    detail: "⏩ Move unfinished tasks to next day",
    isAction: true,
    commandId: Cmd.carryForward,
    kind: 14,
    handler: handleCarryForward,
    cmdFilter: Filter().cursorInWeekDaySection(),
  },
];
