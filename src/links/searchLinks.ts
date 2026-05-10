import * as fs from "fs";
import * as path from "path";
import { Uri } from "../hostEditor/EditorTypes";
import type { QuickPickItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { WorkspaceCache } from "../core/workspaceCache";

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

const LINK_CACHE_VERSION = 1;

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

const linkCache = new WorkspaceCache<LinkRecord>({
  bucket: "links",
  version: LINK_CACHE_VERSION,
  validateRecord: isValidLinkRecord,
});

function getWorkspaceRoot(): string | undefined {
  return hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
}

function readCachedLinks(workspaceRoot: string): LinkRecord[] | undefined {
  return linkCache.read(workspaceRoot);
}

function writeCachedLinks(workspaceRoot: string, records: LinkRecord[]): void {
  linkCache.write(workspaceRoot, records);
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
  const seen = new Set<string>();

  // Read all files in parallel — this used to be a serial fs.readFileSync
  // loop and was the main cost of regenerating the link cache for
  // large workspaces.
  const perFile = await Promise.all(
    files.map(async (file): Promise<LinkRecord[]> => {
      let text: string;
      try {
        text = await fs.promises.readFile(file.fsPath, "utf-8");
      } catch {
        return [];
      }
      const lines = text.split(Regex.lineBreakSplit);
      const sourcePath = path.relative(workspaceRoot, file.fsPath).replace(Regex.windowsSlash, "/");
      const records: LinkRecord[] = [];

      // Local clones of the global regexes to avoid lastIndex races between
      // parallel runs.
      const linkRe = new RegExp(Regex.markdownLinkGlobal.source, Regex.markdownLinkGlobal.flags);
      const anchorRe = new RegExp(Regex.htmlAnchorTagGlobal.source, Regex.htmlAnchorTagGlobal.flags);

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineText = lines[lineIdx];
        const sourceLine = lineIdx + 1;

        linkRe.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = linkRe.exec(lineText)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          pushLinkRecord(records, seen, sourcePath, sourceLine, lineText, start, end, match[2], match[1]);
        }

        anchorRe.lastIndex = 0;
        while ((match = anchorRe.exec(lineText)) !== null) {
          const href = (match[1] ?? match[2] ?? match[3] ?? "").trim();
          const anchorText = (match[4] ?? "").replace(Regex.htmlTagGlobal, "").trim();
          const start = match.index;
          const end = start + match[0].length;
          pushLinkRecord(records, seen, sourcePath, sourceLine, lineText, start, end, href, anchorText);
        }
      }
      return records;
    }),
  );

  const out = perFile.flat();
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
