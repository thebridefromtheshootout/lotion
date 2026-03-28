import { Disposable } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";

/**
 * Clipboard history ring.
 *
 * Tracks the last N clipboard entries (triggered by our smartPaste
 * or explicit copy in markdown files) and provides a quick pick
 * to paste from history.
 */

const MAX_ENTRIES = 30;
const clipHistory: string[] = [];

function addEntry(text: string): void {
  if (!text.trim()) {
    return;
  }
  // Deduplicate
  const idx = clipHistory.indexOf(text);
  if (idx !== -1) {
    clipHistory.splice(idx, 1);
  }
  clipHistory.unshift(text);
  if (clipHistory.length > MAX_ENTRIES) {
    clipHistory.length = MAX_ENTRIES;
  }
}

export async function pasteFromHistory(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  if (clipHistory.length === 0) {
    hostEditor.showInformation("Clipboard history is empty.");
    return;
  }

  const items = clipHistory.map((text, i) => {
    const preview = text.length > 80
      ? text.substring(0, 80).replace(Regex.newlineGlobal, "↵") + "…"
      : text.replace(Regex.newlineGlobal, "↵");
    return {
      label: `${i + 1}. ${preview}`,
      detail: `${text.length} chars`,
      text,
    };
  });

  const picked = await hostEditor.showQuickPick(items, {
    placeHolder: "Paste from clipboard history",
    matchOnDetail: false,
  });

  if (picked) {
    await hostEditor.replaceCurrentSelection(picked.text);
  }
}

/**
 * Track clipboard changes by polling (VS Code doesn't provide
 * a clipboard change event). We record on copy commands.
 */
export function createClipboardHistoryTracker(): Disposable {
  // Intercept copy to record
  const copyDisposable = hostEditor.registerCommand(Cmd.copyToClipboard, async () => {
    const selection = hostEditor.getSelection();
    if (selection && !selection.isEmpty) {
      const text = hostEditor.getDocumentText(selection);
      await hostEditor.writeClipboardText(text);
      addEntry(text);
    } else {
      // Fallback to default copy (whole line)
      await hostEditor.executeCommand("editor.action.clipboardCopyAction");
      const text = await hostEditor.getClipboardText();
      addEntry(text);
    }
  });

  const cutDisposable = hostEditor.registerCommand(Cmd.cutToClipboard, async () => {
    const selection = hostEditor.getSelection();
    if (selection) {
      let text: string;
      if (!selection.isEmpty) {
        text = hostEditor.getDocumentText(selection);
      } else {
        text = hostEditor.getLineText(selection.active.line);
      }
      await hostEditor.executeCommand("editor.action.clipboardCutAction");
      addEntry(text);
    }
  });

  // Also snapshot current clipboard on activation
  hostEditor.getClipboardText().then((text) => {
    if (text) {
      addEntry(text);
    }
  });

  return Disposable.from(copyDisposable, cutDisposable);
}
