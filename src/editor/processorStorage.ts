import * as path from "path";
import * as fs from "fs";
import { hostEditor } from "../hostEditor/HostingEditor";
import { guid } from "../core/ids";
import { loadJsonStore, saveJsonStore } from "../core/jsonStore";

// ── Types ──────────────────────────────────────────────────────────

export interface Processor {
  /** Unique GUID */
  id: string;
  /** Shell command to execute */
  command: string;
  /** Optional shell path/command used to execute the processor command. */
  shell?: string;
  /**
   * Optional working directory the command runs in. Absolute paths are
   * used as-is; relative paths are resolved against the document's
   * directory. When unset, the document's directory is used.
   */
  cwd?: string;
}

// ── Cwd helpers ────────────────────────────────────────────────────

function defaultProcessorCwd(docPath: string): string {
  return path.join(path.dirname(docPath), ".rsrc");
}

export function resolveProcessorCwd(proc: Processor, docPath: string): string {
  const raw = proc.cwd?.trim();
  let resolved: string;
  if (!raw) {
    resolved = defaultProcessorCwd(docPath);
  } else if (path.isAbsolute(raw)) {
    resolved = raw;
  } else {
    resolved = path.resolve(path.dirname(docPath), raw);
  }
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}

export async function promptProcessorCwd(current?: string): Promise<string | undefined> {
  const v = await hostEditor.showInputBox({
    prompt: "Working directory for the processor (leave blank to use this file's .rsrc directory)",
    value: current ?? "",
    placeHolder: "absolute path, or relative to this file's directory",
  });
  if (v === undefined) {
    return undefined;
  }
  return v.trim();
}

// ── JSON storage ───────────────────────────────────────────────────

function getProcessorsFilePath(docPath: string): string {
  const dir = path.dirname(docPath);
  const rsrc = path.join(dir, ".rsrc");
  return path.join(rsrc, "processors.json");
}

export function loadProcessors(docPath: string): Processor[] {
  return loadJsonStore<Processor[]>(getProcessorsFilePath(docPath), []);
}

export function saveProcessors(docPath: string, processors: Processor[]): void {
  saveJsonStore(getProcessorsFilePath(docPath), processors);
}

export function generateGuid(): string {
  return guid();
}
