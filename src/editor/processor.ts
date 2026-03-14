import { CodeLens, Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import { createCodeLensProvider, codeLens } from "../core/codeLens";
import type { SlashCommand } from "../core/slashCommands";

export const PROCESSOR_SLASH_COMMAND: SlashCommand = {
  label: "/processor",
  insertText: "",
  detail: "\ud83d\udd27 Insert a processor block (shell command)",
  isAction: true,
  commandId: Cmd.insertProcessor,
  kind: 14,
  handler: handleProcessorCommand,
};

export const REFRESH_SLASH_COMMAND: SlashCommand = {
  label: "/refresh",
  insertText: "",
  detail: "\ud83d\udd04 Re-run all processor blocks in this file",
  isAction: true,
  commandId: Cmd.refreshProcessors,
  kind: 2,
  when: cursorInProcessor,
  handler: handleRefreshCommand,
};

export const UPDATE_PROCESSOR_SLASH_COMMAND: SlashCommand = {
  label: "/update-processor",
  insertText: "",
  detail: "\u270f\ufe0f Change a processor's shell command",
  isAction: true,
  commandId: Cmd.updateProcessor,
  kind: 2,
  when: cursorInProcessor,
  handler: handleUpdateProcessorCommand,
};

// ── Types ──────────────────────────────────────────────────────────

interface Processor {
  /** Unique GUID */
  id: string;
  /** Shell command to execute */
  command: string;
}

// ── Storage helpers ────────────────────────────────────────────────

function getProcessorsFilePath(docPath: string): string {
  const dir = path.dirname(docPath);
  const rsrc = path.join(dir, ".rsrc");
  return path.join(rsrc, "processors.json");
}

export function loadProcessors(docPath: string): Processor[] {
  const file = getProcessorsFilePath(docPath);
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
}

export function saveProcessors(docPath: string, processors: Processor[]): void {
  const file = getProcessorsFilePath(docPath);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(processors, null, 2), "utf-8");
}

export function generateGuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Marker ID scanning (private) ───────────────────────────────────

const PROC_MARKER_RE_G = Regex.processorMarkerGlobal;

/**
 * Scan arbitrary text for all processor marker UUIDs.
 */
function findProcessorMarkerIds(text: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(PROC_MARKER_RE_G.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

// ── Metadata migration / duplication utilities ─────────────────────

/**
 * Move processor entries from one document to another for any
 * `<!-- lotion-processor: UUID -->` markers found in `text`.
 */
export function migrateProcessors(text: string, srcDocPath: string, destDocPath: string): void {
  const ids = findProcessorMarkerIds(text);
  if (ids.length === 0) {
    return;
  }

  const srcProcs = loadProcessors(srcDocPath);
  const destProcs = loadProcessors(destDocPath);

  const movedIds = new Set(ids);
  const toMove = srcProcs.filter((p) => movedIds.has(p.id));
  const remaining = srcProcs.filter((p) => !movedIds.has(p.id));

  if (toMove.length === 0) {
    return;
  }

  destProcs.push(...toMove);
  saveProcessors(destDocPath, destProcs);
  saveProcessors(srcDocPath, remaining);
}

/**
 * Duplicate every `<!-- lotion-processor: UUID -->` marker in `blockText`:
 * each old UUID is replaced with a fresh one and the corresponding processor
 * entry is cloned in the JSON file.  Returns the rewritten text.
 */
export function duplicateProcessorMarkers(blockText: string, docPath: string): string {
  const ids = findProcessorMarkerIds(blockText);
  if (ids.length === 0) {
    return blockText;
  }

  const allProcs = loadProcessors(docPath);
  for (const oldId of ids) {
    const newId = generateGuid();
    blockText = blockText.replace(
      new RegExp(`<!--\\s*lotion-processor:\\s*${oldId}\\s*-->`),
      `<!-- lotion-processor: ${newId} -->`,
    );
    const original = allProcs.find((p) => p.id === oldId);
    if (original) {
      allProcs.push({ ...original, id: newId });
    }
  }
  saveProcessors(docPath, allProcs);
  return blockText;
}

// ── Processor block markers ────────────────────────────────────────

export const PROC_START_RE = Regex.processorStart;
const PROC_DETAILS_OPEN = Regex.processorDetailsOpen;
const PROC_SUMMARY_OPEN = Regex.processorSummaryOpen;
const PROC_SUMMARY_CLOSE = Regex.processorSummaryClose;
const PROC_DETAILS_CLOSE = Regex.processorDetailsClose;

/**
 * Parsed processor block structure:
 *
 * <!-- lotion-processor: UUID -->
 * <details open>
 * <summary>command output (latest)</summary>
 *
 * input content (optional, the "body" / details area)
 *
 * </details>
 *
 * - The summary holds the latest command output.
 * - The details body holds any input sent to the command.
 * - The command itself lives only in processors.json, linked by the UUID.
 */
function findProcessorBlock(
  document: TextDocument,
  procId: string,
): {
  markerLine: number;
  detailsStart: number;
  summaryStart: number;
  summaryEnd: number;
  bodyStart: number; // first line after summary (may == detailsEnd if no body)
  detailsEnd: number;
} | null {
  for (let i = 0; i < document.lineCount; i++) {
    const m = document.lineAt(i).text.match(PROC_START_RE);
    if (m && m[1] === procId) {
      const markerLine = i;
      let detailsStart = -1;
      let summaryStart = -1;
      let summaryEnd = -1;
      let detailsEnd = -1;

      for (let j = i + 1; j < Math.min(i + 200, document.lineCount); j++) {
        const lt = document.lineAt(j).text;

        if (detailsStart === -1 && PROC_DETAILS_OPEN.test(lt)) {
          detailsStart = j;
          continue;
        }

        if (detailsStart !== -1 && summaryStart === -1 && PROC_SUMMARY_OPEN.test(lt)) {
          summaryStart = j;
          // summary may span multiple lines; find </summary>
          if (PROC_SUMMARY_CLOSE.test(lt)) {
            summaryEnd = j;
          }
          continue;
        }

        if (summaryStart !== -1 && summaryEnd === -1) {
          if (PROC_SUMMARY_CLOSE.test(lt)) {
            summaryEnd = j;
          }
          continue;
        }

        if (summaryEnd !== -1 && PROC_DETAILS_CLOSE.test(lt)) {
          detailsEnd = j;
          break;
        }
      }

      if (detailsStart !== -1 && summaryStart !== -1 && summaryEnd !== -1 && detailsEnd !== -1) {
        const bodyStart = summaryEnd + 1;
        return { markerLine, detailsStart, summaryStart, summaryEnd, bodyStart, detailsEnd };
      }
      return null;
    }
  }
  return null;
}

// ── /processor – Insert a new processor block ──────────────────────

export async function handleProcessorCommand(document: TextDocument, position: Position): Promise<void> {
  const command = await hostEditor.showInputBox({
    prompt: "Shell command to run for this processor",
    placeHolder: "e.g. wc -l *.md | sort -rn",
  });
  if (!command) {
    return;
  }

  const guid = generateGuid();
  const docPath = document.uri.fsPath;

  // Save processor to JSON (only id + command)
  const processors = loadProcessors(docPath);
  processors.push({ id: guid, command });
  saveProcessors(docPath, processors);

  // Run the command to get initial output
  const { output } = runCommand(command, path.dirname(docPath), undefined);

  // Build the block text (no input body initially)
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

    // Read input text from the details body (everything between summary and </details>)
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

    const { output } = runCommand(proc.command, path.dirname(docPath), inputText);

    // Replace the summary content with the new output
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
  if (!newCommand || newCommand === targetProc.command) {
    return;
  }

  targetProc.command = newCommand;
  saveProcessors(docPath, processors);

  // Ask if they want to re-run
  const rerun = await hostEditor.showQuickPick(["Yes", "No"], {
    placeHolder: "Re-run the processor now?",
  });
  if (rerun === "Yes") {
    await handleRefreshCommand(document, position);
  }

  hostEditor.showInformation("Processor command updated.");
}

// ── CodeLens provider ──────────────────────────────────────────────

export function generateProcessorLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const m = document.lineAt(i).text.match(PROC_START_RE);
    if (!m) {
      continue;
    }

    const lineLen = document.lineAt(i).text.length;
    lenses.push(
      codeLens(i, "▶ Run processor", Cmd.refreshProcessors, [document.uri.toString(), i, 0], {
        endChar: lineLen,
      }),
      codeLens(i, "✏️ Edit command", Cmd.updateProcessor, [document.uri.toString(), i, 0], {
        endChar: lineLen,
      }),
    );
  }

  return lenses;
}

export function createProcessorCodeLensProvider(): Disposable {
  return createCodeLensProvider(generateProcessorLenses);
}

// ── Helpers ────────────────────────────────────────────────────────

function runCommand(command: string, cwd: string, stdinInput?: string): { output: string; exitCode: number } {
  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      input: stdinInput,
      stdio: [stdinInput !== undefined ? "pipe" : "pipe", "pipe", "pipe"],
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    return { output: output.trimEnd(), exitCode: 0 };
  } catch (err: any) {
    const output = (err.stdout || "") + (err.stderr ? "\n[stderr] " + err.stderr : "");
    return { output: output.trimEnd() || err.message, exitCode: err.status || 1 };
  }
}

function buildSummaryTag(output: string): string {
  return `<summary>${output}</summary>`;
}

/**
 * True when the cursor is inside a processor block.
 */
export function cursorInProcessor(document: TextDocument, position: Position): boolean {
  for (let i = position.line; i >= 0; i--) {
    const m = document.lineAt(i).text.match(PROC_START_RE);
    if (m) {
      const block = findProcessorBlock(document, m[1]);
      if (block && position.line >= block.markerLine && position.line <= block.detailsEnd) {
        return true;
      }
      return false;
    }
  }
  return false;
}

function buildProcessorBlock(guid: string, output: string, inputBody?: string): string {
  const lines: string[] = [
    `<!-- lotion-processor: ${guid} -->`,
    `<details open>`,
    `<summary>${output}</summary>`,
    ``,
  ];
  if (inputBody !== undefined && inputBody.length > 0) {
    lines.push(inputBody, "");
  }
  lines.push("</details>", "");
  return lines.join("\n");
}
