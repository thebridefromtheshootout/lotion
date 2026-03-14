
import { Position, Range } from "../hostEditor/EditorTypes";
import { hostEditor, OpType, type EditOp } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

/**
 * Convert all inline markdown links to reference-style links, or vice versa.
 *
 * - Inline → Reference: `[text](url)` → `[text][n]` with `[n]: url` at end
 * - Reference → Inline: resolves `[text][ref]` back to `[text](url)`
 *
 * Commands: lotion.linksToReference, lotion.linksToInline
 */

const INLINE_LINK_RE = Regex.inlineLinkUseGlobal;
const REF_LINK_USE_RE = Regex.refLinkUseGlobal;
const REF_LINK_DEF_RE = Regex.refLinkDefinitionGlobalMultiline;

export async function convertLinksToReference(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;
  const text = hostEditor.getDocumentText();
  const matches = [...text.matchAll(INLINE_LINK_RE)];

  if (matches.length === 0) {
    hostEditor.showInformation("No inline links found.");
    return;
  }

  // Collect unique URLs for deduplication
  const urlToRef: Map<string, number> = new Map();
  const refs: { num: number; url: string }[] = [];
  let counter = 1;

  for (const m of matches) {
    const url = m[2];
    if (!urlToRef.has(url)) {
      urlToRef.set(url, counter);
      refs.push({ num: counter, url });
      counter++;
    }
  }

  const ops: EditOp[] = [];

  // Replace inline links from bottom to top to preserve offsets
  const sorted = [...matches].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  for (const m of sorted) {
    const start = doc.positionAt(m.index ?? 0);
    const end = doc.positionAt((m.index ?? 0) + m[0].length);
    const refNum = urlToRef.get(m[2])!;
    ops.push({ type: OpType.Replace, range: new Range(start, end), text: `[${m[1]}][${refNum}]` });
  }

  // Append reference definitions at end
  const lastLine = doc.lineAt(doc.lineCount - 1);
  const suffix = "\n\n" + refs.map((r) => `[${r.num}]: ${r.url}`).join("\n") + "\n";
  ops.push({ type: OpType.Insert, position: lastLine.range.end, text: suffix });

  await hostEditor.batchEdit(ops);

  hostEditor.showInformation(`Converted ${matches.length} inline link(s) to reference style.`);
}

export async function convertLinksToInline(): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const doc = hostEditor.getDocument()!;
  const text = hostEditor.getDocumentText();

  // Build reference map
  const refMap: Map<string, string> = new Map();
  let m: RegExpExecArray | null;
  const re = new RegExp(REF_LINK_DEF_RE.source, "gm");
  while ((m = re.exec(text)) !== null) {
    refMap.set(m[1].toLowerCase(), m[2].trim());
  }

  if (refMap.size === 0) {
    hostEditor.showInformation("No reference link definitions found.");
    return;
  }

  // Find usages
  const usages = [...text.matchAll(REF_LINK_USE_RE)];

  const ops: EditOp[] = [];

  // Replace usages bottom-to-top
  const sorted = [...usages].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  for (const u of sorted) {
    const refKey = u[2].toLowerCase();
    const url = refMap.get(refKey);
    if (url) {
      const start = doc.positionAt(u.index ?? 0);
      const end = doc.positionAt((u.index ?? 0) + u[0].length);
      ops.push({ type: OpType.Replace, range: new Range(start, end), text: `[${u[1]}](${url})` });
    }
  }

  // Remove definition lines
  const defRe2 = new RegExp(REF_LINK_DEF_RE.source, "gm");
  const defs: { start: number; end: number }[] = [];
  let d: RegExpExecArray | null;
  while ((d = defRe2.exec(text)) !== null) {
    defs.push({ start: d.index, end: d.index + d[0].length });
  }
  // Remove bottom-to-top
  for (const def of defs.reverse()) {
    const startPos = doc.positionAt(def.start);
    let endPos = doc.positionAt(def.end);
    // include trailing newline
    if (endPos.line < doc.lineCount - 1) {
      endPos = new Position(endPos.line + 1, 0);
    }
    // include leading blank line if present
    if (startPos.line > 0 && doc.lineAt(startPos.line - 1).text.trim() === "") {
      const adj = new Position(startPos.line - 1, 0);
      ops.push({ type: OpType.Delete, range: new Range(adj, endPos) });
    } else {
      ops.push({ type: OpType.Delete, range: new Range(startPos, endPos) });
    }
  }

  await hostEditor.batchEdit(ops);

  hostEditor.showInformation(`Converted ${usages.length} reference link(s) to inline style.`);
}
