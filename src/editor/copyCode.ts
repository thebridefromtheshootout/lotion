import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { cursorInCodeContext } from "./codeContext";

export const COPY_SLASH_COMMAND: SlashCommand = {
  label: "/copy",
  insertText: "",
  detail: "📋 Copy (code only)",
  isAction: true,
  commandId: Cmd.copyToClipboard,
  kind: 2,
  when: cursorInCodeContext,
};
