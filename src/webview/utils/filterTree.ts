import type { FilterGroup, FilterNode } from "../types";
import { isLeaf } from "../types";

// ── Filter tree path utilities ─────────────────────────────────────

/** Resolve the node at `path` (each element is an index into the parent's `clauses` array). */
export function getNodeByPath(root: FilterGroup, path: number[]): FilterNode {
  let node: FilterNode = root;
  for (const idx of path) {
    node = (node as FilterGroup).clauses[idx];
  }
  return node;
}

/** True if `ancestor` is a strict prefix of `descendant` — i.e. dropping descendant inside ancestor would be a cycle. */
export function isAncestor(ancestor: number[], descendant: number[]): boolean {
  if (ancestor.length >= descendant.length) return false;
  return ancestor.every((v, i) => descendant[i] === v);
}

/**
 * After splicing the node at `removedPath` out of its parent, indices of
 * its later siblings (and any path that traverses through one of those
 * later siblings) shift down by one. This rewrites `toPath` to remain
 * valid against the post-splice tree.
 *
 * The two paths must NOT make `toPath` a descendant of `removedPath` — that
 * case is checked separately via isAncestor and rejected before any move.
 */
export function adjustPathAfterRemoval(toPath: number[], removedPath: number[]): number[] {
  if (removedPath.length === 0) return toPath;
  const parentDepth = removedPath.length - 1;
  const removedIdx = removedPath[parentDepth];

  // toPath must reach at least into the parent depth to be affected.
  if (toPath.length <= parentDepth) return toPath;

  // The shared prefix (parent path) must match exactly.
  for (let i = 0; i < parentDepth; i++) {
    if (toPath[i] !== removedPath[i]) return toPath;
  }

  if (toPath[parentDepth] > removedIdx) {
    const adjusted = [...toPath];
    adjusted[parentDepth] = adjusted[parentDepth] - 1;
    return adjusted;
  }
  return toPath;
}

// ── Used by tests + FilterBar ──────────────────────────────────────

export { isLeaf };
