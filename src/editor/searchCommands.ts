import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import type { QuickPickItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

interface CommandRecord {
  source_path: string;
  source_line: number;
  command: string;
  context: string;
  kind: "inline" | "block";
  language?: string;
}

interface CommandPickItem extends QuickPickItem {
  record: CommandRecord;
}

interface CommandCachePayload {
  version: number;
  workspaceRoot: string;
  generatedAt: string;
  records: CommandRecord[];
}

const CMD_CACHE_VERSION = 2;
const FENCE_OPEN_RE = /^\s*(```|~~~)\s*(\S*)/;
const EXCLUDED_LANGUAGES = new Set(["lotion-db"]);

function getWorkspaceRoot(): string | undefined {
  return hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
}

function getCacheFilePath(workspaceRoot: string): string | undefined {
  const storageRoot = hostEditor.getGlobalStoragePath();
  if (!storageRoot) {
    return undefined;
  }

  const dir = path.join(storageRoot, "cache", "commands");
  fs.mkdirSync(dir, { recursive: true });
  const workspaceKey = createHash("sha1").update(workspaceRoot).digest("hex");
  return path.join(dir, `${workspaceKey}.json`);
}

function readCachedCommands(workspaceRoot: string): CommandRecord[] | undefined {
  const cacheFilePath = getCacheFilePath(workspaceRoot);
  if (!cacheFilePath || !fs.existsSync(cacheFilePath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(cacheFilePath, "utf-8");
    const payload = JSON.parse(raw) as Partial<CommandCachePayload>;
    if (
      payload.version !== CMD_CACHE_VERSION ||
      payload.workspaceRoot !== workspaceRoot ||
      !Array.isArray(payload.records)
    ) {
      return undefined;
    }
    return payload.records;
  } catch {
    return undefined;
  }
}

function writeCachedCommands(workspaceRoot: string, records: CommandRecord[]): void {
  const cacheFilePath = getCacheFilePath(workspaceRoot);
  if (!cacheFilePath) {
    return;
  }

  const payload: CommandCachePayload = {
    version: CMD_CACHE_VERSION,
    workspaceRoot,
    generatedAt: new Date().toISOString(),
    records,
  };
  fs.writeFileSync(cacheFilePath, JSON.stringify(payload), "utf-8");
}

function collectContext(lineText: string, start: number, end: number): string {
  const pre = lineText.slice(Math.max(0, start - 50), start);
  const post = lineText.slice(end, Math.min(lineText.length, end + 50));
  return `${pre}${post}`.trim();
}

/** True if the trimmed content looks like a command (has at least one space). */
function isCommand(code: string): boolean {
  return code.trim().includes(" ");
}

async function collectWorkspaceCommands(workspaceRoot: string): Promise<CommandRecord[]> {
  const files = await hostEditor.findFiles("**/*.md");
  const out: CommandRecord[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const text = fs.readFileSync(file.fsPath, "utf-8");
    const lines = text.split(Regex.lineBreakSplit);
    const sourcePath = path.relative(workspaceRoot, file.fsPath).replace(Regex.windowsSlash, "/");

    // Track fenced code block regions
    let inFencedBlock = false;
    let blockStartLine = 0;
    let blockContent = "";
    let blockLanguage = "";

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];

      // Detect fenced code block boundaries
      const fenceMatch = lineText.match(FENCE_OPEN_RE);
      if (fenceMatch && Regex.fencedCodeDelimiter.test(lineText)) {
        if (!inFencedBlock) {
          inFencedBlock = true;
          blockStartLine = lineIdx + 1; // 1-based
          blockContent = "";
          blockLanguage = (fenceMatch[2] || "").toLowerCase();
        } else {
          // End of block — check the accumulated content
          inFencedBlock = false;
          const trimmed = blockContent.trim();
          if (!EXCLUDED_LANGUAGES.has(blockLanguage) && trimmed.length > 0 && isCommand(trimmed)) {
            const dedupeKey = `${sourcePath}|block|${trimmed}`;
            if (!seen.has(dedupeKey)) {
              seen.add(dedupeKey);
              out.push({
                source_path: sourcePath,
                source_line: blockStartLine,
                command: trimmed,
                context: sourcePath,
                kind: "block",
                language: blockLanguage || undefined,
              });
            }
          }
        }
        continue;
      }

      if (inFencedBlock) {
        blockContent += (blockContent.length > 0 ? "\n" : "") + lineText;
        continue;
      }

      // Inline code: `content`
      Regex.inlineCodeNoNewlineGlobal.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = Regex.inlineCodeNoNewlineGlobal.exec(lineText)) !== null) {
        const code = match[1];
        if (!isCommand(code)) continue;

        const trimmed = code.trim();
        const dedupeKey = `${sourcePath}|${lineIdx + 1}|${trimmed}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        out.push({
          source_path: sourcePath,
          source_line: lineIdx + 1,
          command: trimmed,
          context: collectContext(lineText, match.index, match.index + match[0].length),
          kind: "inline",
        });
      }
    }
  }

  // Bash blocks first, then other blocks, then inline
  const priority = (r: CommandRecord) => {
    if (r.kind === "block" && (r.language === "bash" || r.language === "sh")) return 0;
    if (r.kind === "block") return 1;
    return 2;
  };
  out.sort((a, b) => priority(a) - priority(b) || a.source_path.localeCompare(b.source_path) || a.source_line - b.source_line);
  return out;
}

function filterRecords(records: CommandRecord[], query: string): CommandRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return records;
  }

  const byCommand = records.filter((r) => r.command.toLowerCase().includes(q));
  if (byCommand.length > 0) {
    return byCommand;
  }
  return records.filter((r) => r.context.toLowerCase().includes(q));
}

function toPickItems(records: CommandRecord[]): CommandPickItem[] {
  return records.map((record) => ({
    label: record.command,
    description: `${record.source_path}:${record.source_line}`,
    detail: record.kind === "block" ? (record.language ? `Code block (${record.language})` : "Code block") : "Inline code",
    record,
  }));
}

export async function searchWorkspaceCommands(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    hostEditor.showWarning("No workspace folder is open.");
    return;
  }

  const cachedRecords = readCachedCommands(workspaceRoot);
  let records: CommandRecord[] = cachedRecords ?? [];
  const hadCachedRecords = cachedRecords !== undefined;

  if (cachedRecords === undefined) {
    records = await collectWorkspaceCommands(workspaceRoot);
    writeCachedCommands(workspaceRoot, records);
  }

  if (records.length === 0) {
    hostEditor.showInformation("No commands found in workspace markdown files.");
    return;
  }

  const qp = hostEditor.createQuickPick<CommandPickItem>();
  qp.placeholder = "Search commands (code blocks & inline code with spaces)…";
  qp.matchOnDescription = true;
  qp.matchOnDetail = true;
  qp.items = toPickItems(records);

  let debounceTimer: NodeJS.Timeout | undefined;
  let quickPickDisposed = false;

  if (hadCachedRecords) {
    void collectWorkspaceCommands(workspaceRoot)
      .then((freshRecords) => {
        records = freshRecords;
        writeCachedCommands(workspaceRoot, freshRecords);
        if (!quickPickDisposed) {
          qp.items = toPickItems(filterRecords(records, qp.value));
        }
      })
      .catch(() => {
        // Keep using cached records if refresh fails.
      });
  }

  qp.onDidChangeValue((query) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    qp.busy = true;
    debounceTimer = setTimeout(() => {
      const filtered = filterRecords(records, query);
      qp.items = toPickItems(filtered);
      qp.busy = false;
    }, 180);
  });

  const pick = await new Promise<CommandPickItem | undefined>((resolve) => {
    qp.onDidAccept(() => {
      resolve(qp.selectedItems[0]);
      qp.dispose();
    });
    qp.onDidHide(() => {
      quickPickDisposed = true;
      resolve(undefined);
      qp.dispose();
    });
    qp.show();
  });

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (!pick) {
    return;
  }

  // Copy command to system clipboard
  await hostEditor.writeClipboardText(pick.record.command);
  hostEditor.showInformation(`Copied: ${pick.record.command}`);
}
