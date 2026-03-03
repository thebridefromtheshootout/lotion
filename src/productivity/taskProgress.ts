import { Disposable, StatusBarAlignment } from "../hostEditor/EditorTypes";
import type { StatusBarItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

// ── Task progress status bar ───────────────────────────────────────
//
// Shows "✓ 3/5 tasks" in the status bar for markdown files containing
// checkbox items, giving a quick overview of completion progress.

const TASK_RE = /^\s*[-*+] \[ \]/gm;
const DONE_RE = /^\s*[-*+] \[x\]/gim;

let statusBarItem: StatusBarItem | undefined;

export function createTaskProgressStatusBar(): Disposable {
  statusBarItem = hostEditor.createStatusBarItem(StatusBarAlignment.Right, 98);

  updateTaskProgress();

  hostEditor.onDidChangeActiveTextEditor(() => updateTaskProgress());
  const disposables: Disposable[] = [
    statusBarItem,
    hostEditor.onDidChangeTextDocument((e) => {
      if (hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
        updateTaskProgress();
      }
    }),
  ];

  return Disposable.from(...disposables);
}

function updateTaskProgress(): void {
  if (!statusBarItem) {
    return;
  }

  if (!hostEditor.isMarkdownEditor()) {
    statusBarItem.hide();
    return;
  }

  const text = hostEditor.getDocumentText();
  const pending = (text.match(TASK_RE) || []).length;
  const done = (text.match(DONE_RE) || []).length;
  const total = pending + done;

  if (total === 0) {
    statusBarItem.hide();
    return;
  }

  const pct = Math.round((done / total) * 100);
  statusBarItem.text = `$(check) ${done}/${total} tasks`;
  statusBarItem.tooltip = `Tasks: ${done} completed, ${pending} remaining (${pct}%)`;
  statusBarItem.show();
}
