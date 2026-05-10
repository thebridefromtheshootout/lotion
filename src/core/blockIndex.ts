// Per-document index of structural blocks (code fences, <details>, callouts, tables).
// Built in a single linear pass; consumers query via O(log N) binary search.
//
// Read path is synchronous: getBlockIndex(doc) always returns a real index. On a
// cache miss it builds now. Background path keeps the cache warm: on text change
// a 50ms throttled rebuild is scheduled (initBlockIndex wires this in extension.ts).

import type { Disposable, TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import type { BlockIndex } from "./blockIndexTypes";
import { build } from "./blockIndexBuild";

// ── Re-exports of types ────────────────────────────────────────────

export type {
  BlockIndex,
  CodeFence,
  CalloutKind,
  DetailsKind,
  DetailsBlock,
  MarkdownCallout,
  MarkdownTable,
} from "./blockIndexTypes";

// ── Per-document cache ─────────────────────────────────────────────

interface CacheEntry {
  index: BlockIndex;
}

const cache = new WeakMap<TextDocument, CacheEntry>();
const pendingTimers = new WeakMap<TextDocument, ReturnType<typeof setTimeout>>();
const REBUILD_DELAY_MS = 50;

export function getBlockIndex(doc: TextDocument): BlockIndex {
  const cached = cache.get(doc);
  if (cached && cached.index.version === doc.version) {
    return cached.index;
  }
  const index = build(doc);
  cache.set(doc, { index });
  return index;
}

function scheduleRebuild(doc: TextDocument): void {
  const existing = pendingTimers.get(doc);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    pendingTimers.delete(doc);
    const cached = cache.get(doc);
    if (cached && cached.index.version === doc.version) {
      return; // a synchronous read already filled the cache
    }
    cache.set(doc, { index: build(doc) });
  }, REBUILD_DELAY_MS);
  pendingTimers.set(doc, timer);
}

export function initBlockIndex(): Disposable {
  return hostEditor.onDidChangeTextDocument((e) => {
    if (e.document.languageId !== "markdown") return;
    scheduleRebuild(e.document);
  });
}
