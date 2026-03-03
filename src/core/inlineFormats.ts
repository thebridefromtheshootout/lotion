// ── Inline formatting commands registry ─────────────────────────────
// Marker-based formatting commands that toggle wrap markers around text

import { Cmd } from "./commands";

/**
 * Array of [commandId, marker] tuples for inline formatting.
 * Each command wraps/unwraps selected text with the specified marker.
 */
export const INLINE_FORMATS: [string, string][] = [
  [Cmd.toggleBold, "**"],
  [Cmd.toggleItalic, "*"],
  [Cmd.toggleStrikethrough, "~~"],
  [Cmd.toggleInlineCode, "`"],
  [Cmd.toggleHighlight, "=="],
];
