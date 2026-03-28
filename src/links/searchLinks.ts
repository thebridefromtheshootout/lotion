import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { Uri } from "../hostEditor/EditorTypes";
import type { QuickPickItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

interface LinkRecord {
  source_path: string;
  source_line: number;
  link_text: string;
  raw_target: string;
  context: string;
}

interface LinkPickItem extends QuickPickItem {
  record: LinkRecord;
}

interface LinkCachePayload {
  version: number;
  workspaceRoot: string;
  generatedAt: string;
  records: LinkRecord[];
}

const LINK_CACHE_VERSION = 1;

function getWorkspaceRoot(): string | undefined {
  return hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
}

function getLinkCacheFilePath(workspaceRoot: string): string | undefined {
  const storageRoot = hostEditor.getGlobalStoragePath();
  if (!storageRoot) {
    return undefined;
  }

  const dir = path.join(storageRoot, "cache", "links");
  fs.mkdirSync(dir, { recursive: true });
  const workspaceKey = createHash("sha1").update(workspaceRoot).digest("hex");
  return path.join(dir, `${workspaceKey}.json`);
}

function isValidLinkRecord(value: unknown): value is LinkRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.source_path === "string" &&
    typeof row.source_line === "number" &&
    typeof row.link_text === "string" &&
    typeof row.raw_target === "string" &&
    typeof row.context === "string"
  );
}

function readCachedLinks(workspaceRoot: string): LinkRecord[] | undefined {
  const cacheFilePath = getLinkCacheFilePath(workspaceRoot);
  if (!cacheFilePath || !fs.existsSync(cacheFilePath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(cacheFilePath, "utf-8");
    const payload = JSON.parse(raw) as Partial<LinkCachePayload>;
    if (
      payload.version !== LINK_CACHE_VERSION ||
      payload.workspaceRoot !== workspaceRoot ||
      !Array.isArray(payload.records)
    ) {
      return undefined;
    }
    return payload.records.filter(isValidLinkRecord);
  } catch {
    return undefined;
  }
}

function writeCachedLinks(workspaceRoot: string, records: LinkRecord[]): void {
  const cacheFilePath = getLinkCacheFilePath(workspaceRoot);
  if (!cacheFilePath) {
    return;
  }

  const payload: LinkCachePayload = {
    version: LINK_CACHE_VERSION,
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

function pushLinkRecord(
  out: LinkRecord[],
  seen: Set<string>,
  sourcePath: string,
  sourceLine: number,
  lineText: string,
  start: number,
  end: number,
  rawTarget: string,
  linkText: string,
): void {
  if (!Regex.httpSchemePrefix.test(rawTarget)) {
    return;
  }

  const dedupeKey = `${sourcePath}|${sourceLine}|${rawTarget}`;
  if (seen.has(dedupeKey)) {
    return;
  }
  seen.add(dedupeKey);

  out.push({
    source_path: sourcePath,
    source_line: sourceLine,
    link_text: linkText.trim(),
    raw_target: rawTarget.trim(),
    context: collectContext(lineText, start, end),
  });
}

async function collectWorkspaceHttpLinks(workspaceRoot: string): Promise<LinkRecord[]> {
  const files = await hostEditor.findFiles("**/*.md");
  const out: LinkRecord[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const text = fs.readFileSync(file.fsPath, "utf-8");
    const lines = text.split(Regex.lineBreakSplit);
    const sourcePath = path.relative(workspaceRoot, file.fsPath).replace(Regex.windowsSlash, "/");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      const sourceLine = lineIdx + 1;

      // Markdown links: [text](target)
      Regex.markdownLinkGlobal.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = Regex.markdownLinkGlobal.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        pushLinkRecord(out, seen, sourcePath, sourceLine, lineText, start, end, match[2], match[1]);
      }

      // HTML anchors: <a href="target">text</a>
      Regex.htmlAnchorTagGlobal.lastIndex = 0;
      while ((match = Regex.htmlAnchorTagGlobal.exec(lineText)) !== null) {
        const href = (match[1] ?? match[2] ?? match[3] ?? "").trim();
        const anchorText = (match[4] ?? "").replace(Regex.htmlTagGlobal, "").trim();
        const start = match.index;
        const end = start + match[0].length;
        pushLinkRecord(out, seen, sourcePath, sourceLine, lineText, start, end, href, anchorText);
      }
    }
  }

  out.sort((a, b) => a.source_path.localeCompare(b.source_path) || a.source_line - b.source_line);
  return out;
}

function filterRecords(records: LinkRecord[], query: string): LinkRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return records;
  }

  const byText = records.filter((r) => r.link_text.toLowerCase().includes(q));
  if (byText.length > 0) {
    return byText;
  }
  return records.filter((r) => r.context.toLowerCase().includes(q));
}

function toPickItems(records: LinkRecord[]): LinkPickItem[] {
  return records.map((record) => ({
    label: record.link_text || record.raw_target,
    description: `${record.source_path}:${record.source_line}`,
    detail: record.raw_target,
    record,
  }));
}

export async function searchWorkspaceLinks(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    hostEditor.showWarning("No workspace folder is open.");
    return;
  }

  const cachedRecords = readCachedLinks(workspaceRoot);
  let records: LinkRecord[] = cachedRecords ?? [];
  const hadCachedRecords = cachedRecords !== undefined;

  if (cachedRecords === undefined) {
    records = await collectWorkspaceHttpLinks(workspaceRoot);
    writeCachedLinks(workspaceRoot, records);
  }

  if (records.length === 0) {
    hostEditor.showInformation("No external http/https links found in workspace markdown files.");
    return;
  }

  const qp = hostEditor.createQuickPick<LinkPickItem>();
  qp.placeholder = "Search links (link text first, then context fallback)…";
  qp.matchOnDescription = true;
  qp.matchOnDetail = true;
  qp.items = toPickItems(records);

  let debounceTimer: NodeJS.Timeout | undefined;
  let quickPickDisposed = false;

  if (hadCachedRecords) {
    void collectWorkspaceHttpLinks(workspaceRoot)
      .then((freshRecords) => {
        records = freshRecords;
        writeCachedLinks(workspaceRoot, freshRecords);
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

  const pick = await new Promise<LinkPickItem | undefined>((resolve) => {
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

  try {
    const opened = await hostEditor.openExternal(Uri.parse(pick.record.raw_target));
    if (!opened) {
      hostEditor.showWarning(`Could not open link: ${pick.record.raw_target}`);
    }
  } catch {
    hostEditor.showError(`Invalid link target: ${pick.record.raw_target}`);
  }
}
