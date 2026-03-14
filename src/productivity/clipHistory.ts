import { Disposable } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { copyCurrentTableColumnToClipboard, cursorInTable } from "../editor/table";

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
    const preview = text.length > 80 ? text.substring(0, 80).replace(/\n/g, "↵") + "…" : text.replace(/\n/g, "↵");
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
    const doc = hostEditor.getDocument();
    const pos = hostEditor.getCursorPosition();
    const selection = hostEditor.getSelection();
    if (doc && pos && selection?.isEmpty && cursorInTable(doc, pos)) {
      const copied = await copyCurrentTableColumnToClipboard(false);
      if (copied) {
        const text = await hostEditor.getClipboardText();
        addEntry(text);
        return;
      }
    }
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
    const doc = hostEditor.getDocument();
    const pos = hostEditor.getCursorPosition();
    const selection = hostEditor.getSelection();
    if (doc && pos && selection?.isEmpty && cursorInTable(doc, pos)) {
      const cut = await copyCurrentTableColumnToClipboard(true);
      if (cut) {
        const text = await hostEditor.getClipboardText();
        addEntry(text);
        return;
      }
    }
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
