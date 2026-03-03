import { Position } from "../../hostEditor/EditorTypes";
import type { TextDocument } from "../../hostEditor/EditorTypes";
import { hostEditor } from "../../hostEditor/HostingEditor";
import { formatDate, FORMAT_KEYS } from "./dateFormat";
import { Cmd } from "../../core/commands";
import type { SlashCommand } from "../../core/slashCommands";

export const TODAY_SLASH_COMMAND: SlashCommand = {
  label: "/today",
  insertText: "",
  detail: "\ud83d\udcc5 Insert today's date",
  isAction: true,
  commandId: Cmd.insertToday,
  kind: 12,
  handler: handleTodayCommand,
};

// ── Persistent defaults (session-only) ─────────────────────────────

let _lastFormat: string = FORMAT_KEYS[0];

export function lastFormat(): string {
  return _lastFormat;
}
export function setLastFormat(fmt: string): void {
  _lastFormat = fmt;
}

// ── /today – Insert today's date ───────────────────────────────────

/**
 * /today – pick a format, insert today's date.
 */
export async function handleTodayCommand(document: TextDocument, position: Position): Promise<void> {
  const now = new Date();

  const formats = FORMAT_KEYS.map((fmt) => ({
    label: formatDate(now, fmt),
    detail: fmt,
    fmt,
  }));

  // Put last-used format first
  formats.sort((a, b) => (a.fmt === _lastFormat ? -1 : b.fmt === _lastFormat ? 1 : 0));

  const pick = await hostEditor.showQuickPick(formats, {
    placeHolder: "Choose a date format",
  });
  if (!pick) {
    return;
  }

  _lastFormat = pick.fmt;

  await hostEditor.showTextDocument(document);
  await hostEditor.insertAt(position, pick.label);
}
