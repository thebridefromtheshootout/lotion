import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

import {
  Processor,
  generateGuid,
  loadProcessors,
  resolveProcessorCwd,
  promptProcessorCwd,
  saveProcessors,
} from "./processorStorage";
import {
  ensureWindowsProcessorShell,
  promptWindowsShellPath,
} from "./processorWindowsShell";
import {
  buildProcessorBlock,
  buildSummaryTag,
  findProcessorBlock,
} from "./processorBlock";
import { runCommand } from "./processorRun";

// ── Slash command exports ──────────────────────────────────────────

export const PROCESSOR_SLASH_COMMAND: SlashCommand = {
  label: "/processor",
  insertText: "",
  detail: "🔧 Insert a processor block (shell command)",
  isAction: true,
  commandId: Cmd.insertProcessor,
  kind: 14,
  cmdFilter: Filter().pageIsNotDbIndex(),
  handler: handleProcessorCommand,
  cleanLine: true,
};

export const REFRESH_SLASH_COMMAND: SlashCommand = {
  label: "/refresh",
  insertText: "",
  detail: "🔄 Re-run all processor blocks in this file",
  isAction: true,
  commandId: Cmd.refreshProcessors,
  kind: 2,
  cmdFilter: Filter().cursorInProcessor(),
  handler: handleRefreshCommand,
};

export const UPDATE_PROCESSOR_SLASH_COMMAND: SlashCommand = {
  label: "/update-processor",
  insertText: "",
  detail: "✏️ Change a processor's shell command",
  isAction: true,
  commandId: Cmd.updateProcessor,
  kind: 2,
  cmdFilter: Filter().cursorInProcessor(),
  handler: handleUpdateProcessorCommand,
};

// ── Re-exports ─────────────────────────────────────────────────────

export { loadProcessors, saveProcessors, generateGuid } from "./processorStorage";
export { migrateProcessors, duplicateProcessorMarkers } from "./processorMarkers";
export { PROC_START_RE, cursorInProcessor } from "./processorBlock";
export { generateProcessorLenses, createProcessorCodeLensProvider } from "./processorCodeLens";

// ── /processor – Insert a new processor block ──────────────────────

export async function handleProcessorCommand(document: TextDocument, position: Position): Promise<void> {
  const command = await hostEditor.showInputBox({
    prompt: "Shell command to run for this processor",
    placeHolder: "e.g. wc -l *.md | sort -rn",
  });
  if (!command) {
    return;
  }

  let shell: string | undefined;
  if (process.platform === "win32") {
    shell = await promptWindowsShellPath();
    if (!shell) {
      return;
    }
  }

  const cwd = await promptProcessorCwd();
  if (cwd === undefined) {
    return;
  }

  const guid = generateGuid();
  const docPath = document.uri.fsPath;

  const proc: Processor = { id: guid, command, shell };
  if (cwd.length > 0) {
    proc.cwd = cwd;
  }

  const processors = loadProcessors(docPath);
  processors.push(proc);
  saveProcessors(docPath, processors);

  const { output } = runCommand(command, resolveProcessorCwd(proc, docPath), undefined, shell);

  const block = buildProcessorBlock(guid, output);

  await hostEditor.showTextDocument(document);
  await hostEditor.insertAt(position, block);
}

// ── /refresh – Re-run all processors in current file ───────────────

export async function handleRefreshCommand(document: TextDocument, _position: Position): Promise<void> {
  const docPath = document.uri.fsPath;
  const processors = loadProcessors(docPath);
  if (processors.length === 0) {
    hostEditor.showInformation("No processor blocks found for this file.");
    return;
  }

  const editor = await hostEditor.showTextDocument(document);
  let updated = 0;

  for (const proc of processors) {
    // Re-read the document each iteration since edits shift line numbers
    const doc = editor.document;
    const block = findProcessorBlock(doc, proc.id);
    if (!block) {
      continue;
    }

    let inputText: string | undefined;
    if (block.bodyStart < block.detailsEnd) {
      const lines: string[] = [];
      for (let li = block.bodyStart; li < block.detailsEnd; li++) {
        lines.push(doc.lineAt(li).text);
      }
      const body = lines.join("\n").trim();
      if (body.length > 0) {
        inputText = body;
      }
    }

    let shell = proc.shell;
    if (process.platform === "win32") {
      shell = await ensureWindowsProcessorShell(proc, docPath, processors);
      if (!shell) {
        continue;
      }
    }

    const { output } = runCommand(proc.command, resolveProcessorCwd(proc, docPath), inputText, shell);

    const summaryStartPos = new Position(block.summaryStart, 0);
    const summaryEndPos = new Position(block.summaryEnd, doc.lineAt(block.summaryEnd).text.length);

    const newSummary = buildSummaryTag(output);

    await hostEditor.replaceRange(new Range(summaryStartPos, summaryEndPos), newSummary);
    updated++;
  }

  hostEditor.showInformation(`Refreshed ${updated} processor block${updated !== 1 ? "s" : ""}.`);
}

// ── /update-processor – Change the command of a processor ──────────

export async function handleUpdateProcessorCommand(document: TextDocument, position: Position): Promise<void> {
  const docPath = document.uri.fsPath;
  const processors = loadProcessors(docPath);

  if (processors.length === 0) {
    hostEditor.showWarning("No processor blocks found for this file.");
    return;
  }

  // If cursor is inside a processor block, update that one; otherwise show picker
  let targetProc: Processor | undefined;
  for (const proc of processors) {
    const block = findProcessorBlock(document, proc.id);
    if (block && position.line >= block.markerLine && position.line <= block.detailsEnd) {
      targetProc = proc;
      break;
    }
  }

  if (!targetProc) {
    const items = processors.map((p) => ({
      label: p.command,
      detail: `ID: ${p.id}`,
      proc: p,
    }));

    const picked = await hostEditor.showQuickPick(items, {
      placeHolder: "Select a processor to update",
    });
    if (!picked) {
      return;
    }
    targetProc = picked.proc;
  }

  const newCommand = await hostEditor.showInputBox({
    prompt: "New shell command",
    value: targetProc.command,
  });
  if (newCommand === undefined || newCommand.length === 0) {
    return;
  }

  const newCwd = await promptProcessorCwd(targetProc.cwd);
  if (newCwd === undefined) {
    return;
  }

  if (process.platform === "win32") {
    const selectedShell = await promptWindowsShellPath(targetProc.shell);
    if (!selectedShell) {
      return;
    }
    targetProc.shell = selectedShell;
  }

  targetProc.command = newCommand;
  if (newCwd.length > 0) {
    targetProc.cwd = newCwd;
  } else {
    delete targetProc.cwd;
  }
  saveProcessors(docPath, processors);

  const rerun = await hostEditor.showQuickPick(["Yes", "No"], {
    placeHolder: "Re-run the processor now?",
  });
  if (rerun === "Yes") {
    await handleRefreshCommand(document, position);
  }

  hostEditor.showInformation("Processor command updated.");
}
