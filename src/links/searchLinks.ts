import * as fs from "fs";
import * as path from "path";
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

function collectContext(lineText: string, start: number, end: number): string {
  const pre = lineText.slice(Math.max(0, start - 50), start);
  const post = lineText.slice(end, Math.min(lineText.length, end + 50));
  return `${pre}${post}`.trim();
}

async function collectWorkspaceHttpLinks(): Promise<LinkRecord[]> {
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return [];
  }

  const files = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  const out: LinkRecord[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const text = fs.readFileSync(file.fsPath, "utf-8");
    const lines = text.split(Regex.lineBreakSplit);
    const sourcePath = path.relative(workspaceRoot, file.fsPath).replace(Regex.windowsSlash, "/");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      Regex.markdownLinkGlobal.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = Regex.markdownLinkGlobal.exec(lineText)) !== null) {
        const rawTarget = match[2].trim();
        if (!Regex.httpSchemePrefix.test(rawTarget)) {
          continue;
        }

        const sourceLine = lineIdx + 1;
        const dedupeKey = `${sourcePath}|${sourceLine}|${rawTarget}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);

        const start = match.index;
        const end = start + match[0].length;
        out.push({
          source_path: sourcePath,
          source_line: sourceLine,
          link_text: match[1].trim(),
          raw_target: rawTarget,
          context: collectContext(lineText, start, end),
        });
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

export async function searchWorkspaceLinks(): Promise<void> {
  const records = await collectWorkspaceHttpLinks();
  if (records.length === 0) {
    hostEditor.showInformation("No external http/https links found in workspace markdown files.");
    return;
  }

  const query = await hostEditor.showInputBox({
    prompt: "Search links (matches link text first, then context fallback)",
    placeHolder: "e.g. auth, docs, api",
  });
  if (query === undefined) {
    return;
  }

  const filtered = filterRecords(records, query);
  if (filtered.length === 0) {
    hostEditor.showInformation("No matching links found.");
    return;
  }

  const picks: LinkPickItem[] = filtered.map((record) => ({
    label: record.link_text || record.raw_target,
    description: `${record.source_path}:${record.source_line}`,
    detail: record.raw_target,
    record,
  }));

  const pick = await hostEditor.showQuickPick(picks, {
    placeHolder: "Select a link to open in browser",
    matchOnDescription: true,
    matchOnDetail: true,
  });
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
