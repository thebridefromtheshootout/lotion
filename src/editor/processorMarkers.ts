import { Regex } from "../core/regex";
import { generateGuid, loadProcessors, saveProcessors } from "./processorStorage";

// ── Marker ID scanning ─────────────────────────────────────────────

const PROC_MARKER_RE_G = Regex.processorMarkerGlobal;

/** Scan arbitrary text for all processor marker UUIDs. */
function findProcessorMarkerIds(text: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(PROC_MARKER_RE_G.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

// ── Migration / duplication utilities ──────────────────────────────

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
 * entry is cloned in the JSON file. Returns the rewritten text.
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
