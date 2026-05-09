import { adjustPathAfterRemoval, getNodeByPath, isAncestor } from "../webview/utils/filterTree";
import type { FilterGroup } from "../webview/types";

const leaf = (col: string, value: string) => ({ col, op: "==" as const, value });

const sampleTree = (): FilterGroup => ({
  logic: "AND",
  clauses: [
    leaf("Status", "Active"),
    leaf("Owner", "Hardik"),
    {
      logic: "OR",
      clauses: [leaf("Tag", "x"), leaf("Tag", "y")],
    },
  ],
});

describe("getNodeByPath", () => {
  it("returns the root for an empty path", () => {
    const tree = sampleTree();
    expect(getNodeByPath(tree, [])).toBe(tree);
  });

  it("traverses indices into the tree", () => {
    const tree = sampleTree();
    expect(getNodeByPath(tree, [0])).toEqual(leaf("Status", "Active"));
    expect(getNodeByPath(tree, [2, 1])).toEqual(leaf("Tag", "y"));
  });
});

describe("isAncestor", () => {
  it("returns false for equal paths", () => {
    expect(isAncestor([0, 1], [0, 1])).toBe(false);
  });

  it("returns true when ancestor is a strict prefix of descendant", () => {
    expect(isAncestor([0], [0, 2])).toBe(true);
    expect(isAncestor([], [3])).toBe(true);
  });

  it("returns false when paths diverge", () => {
    expect(isAncestor([0, 1], [0, 2])).toBe(false);
    expect(isAncestor([1], [0, 2])).toBe(false);
  });
});

describe("adjustPathAfterRemoval", () => {
  it("decrements the index when target is a later sibling at the same depth", () => {
    // Root: [a, b, OR-group]; remove a (path [0]); OR was at [2], should now be [1].
    expect(adjustPathAfterRemoval([2], [0])).toEqual([1]);
  });

  it("decrements when target traverses through a later sibling at depth", () => {
    // Drop something at root[0] that lives to the right of an OR-group at root[2].
    // The OR-group is at index 2; after removing root[0], it's at 1.
    // A path through it like [2, 0] needs to become [1, 0].
    expect(adjustPathAfterRemoval([2, 0], [0])).toEqual([1, 0]);
  });

  it("leaves target unchanged when source is an earlier sibling at a deeper subtree", () => {
    // Remove root[0,1]. Target [1, 0] is in a totally different parent — no shift.
    expect(adjustPathAfterRemoval([1, 0], [0, 1])).toEqual([1, 0]);
  });

  it("leaves target unchanged when target's index at parent depth is < source index", () => {
    // Remove root[2]; target [0] sits before it — unaffected.
    expect(adjustPathAfterRemoval([0], [2])).toEqual([0]);
  });

  it("decrements only the parent depth, deeper indices intact", () => {
    // Remove root[1]; target [3, 4, 5] passes through root[3] (after root[1]).
    // Depth-0 index 3 > 1, decrement to 2; deeper indices unchanged.
    expect(adjustPathAfterRemoval([3, 4, 5], [1])).toEqual([2, 4, 5]);
  });

  it("does nothing when the removed path is the empty array", () => {
    expect(adjustPathAfterRemoval([0, 1], [])).toEqual([0, 1]);
  });

  it("works for the bug-from-issue case (root[0] dragged to root[2])", () => {
    // Reproduces the original bug: dragging a tile from root[0] onto an
    // OR-group at root[2] used to silently fail because [2] became invalid
    // after the splice.
    const fromPath = [0];
    const toPath = [2];
    expect(adjustPathAfterRemoval(toPath, fromPath)).toEqual([1]);
  });
});
