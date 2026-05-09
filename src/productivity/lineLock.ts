import { Disposable, StatusBarAlignment } from "../hostEditor/EditorTypes";
import type { StatusBarItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";

// ── Line Lock ─────────────────────────────────────────────────────
//
// When toggled on, every cursor line change scrolls the editor by the
// matching number of lines (using vscode's `editorScroll` command with
// `revealCursor: false`) so the cursor stays at the same screen Y.
//
// Default off. Click the status bar button to toggle.

let statusBarItem: StatusBarItem | undefined;
let enabled = false;
/** Last cursor line we observed in the active editor; reset when toggling or switching editors. */
let lastLine: number | undefined;
/** Set while we're issuing a scroll command, to ignore the scroll-induced selection event. */
let scrolling = false;

export function createLineLock(): Disposable {
  statusBarItem = hostEditor.createStatusBarItem(StatusBarAlignment.Right, 95);
  statusBarItem.command = Cmd.toggleLineLock;
  render();
  statusBarItem.show();

  const cmd = hostEditor.registerCommand(Cmd.toggleLineLock, toggle);

  const selSub = hostEditor.onDidChangeTextEditorSelection(() => {
    if (!enabled) return;
    if (scrolling) return;
    const sel = hostEditor.getSelection();
    if (!sel) return;
    const cur = sel.active.line;
    if (lastLine === undefined) {
      lastLine = cur;
      return;
    }
    const delta = cur - lastLine;
    lastLine = cur;
    if (delta === 0) return;
    scrolling = true;
    const args = {
      to: delta > 0 ? "down" : "up",
      by: "wrappedLine",
      value: Math.abs(delta),
      revealCursor: false,
    };
    void hostEditor.executeCommand("editorScroll", args).finally(() => {
      scrolling = false;
    });
  });

  const editorSub = hostEditor.onDidChangeActiveTextEditor(() => {
    // Reset baseline so switching files doesn't scroll based on a stale lastLine.
    lastLine = undefined;
  });

  return Disposable.from(statusBarItem, cmd, selSub, editorSub);
}

function toggle(): void {
  enabled = !enabled;
  lastLine = enabled ? hostEditor.getSelection()?.active.line : undefined;
  render();
}

function render(): void {
  if (!statusBarItem) return;
  if (enabled) {
    statusBarItem.text = "$(lock) Line Lock";
    statusBarItem.tooltip = "Line Lock is ON — click to disable. Cursor stays at the same screen position as you navigate.";
  } else {
    statusBarItem.text = "$(unlock) Line Lock";
    statusBarItem.tooltip = "Line Lock is OFF — click to enable.";
  }
}
