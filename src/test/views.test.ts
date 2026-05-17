import * as assert from "assert";
import * as vscode from "vscode";
import { HeadingOutlineProvider } from "../views/outline";
import { activate, closeAllEditors, openMarkdown, run } from "./_helpers";

describe("views & outline feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("HeadingOutlineProvider returns top-level headings from the active doc", async () => {
    await openMarkdown("# Alpha\nbody\n# Beta\n# Gamma");
    const provider = new HeadingOutlineProvider();
    const roots = provider.getChildren();
    const labels = roots.map((r) => String(r.label));
    assert.deepStrictEqual(labels, ["Alpha", "Beta", "Gamma"]);
  });

  it("HeadingOutlineProvider nests H2 children under their H1 parent", async () => {
    await openMarkdown("# Parent\n## Child A\n## Child B\n# Sibling");
    const provider = new HeadingOutlineProvider();
    const roots = provider.getChildren();
    assert.strictEqual(roots.length, 2, "two top-level headings");
    const parent = roots[0];
    const kids = provider.getChildren(parent).map((k) => String(k.label));
    assert.deepStrictEqual(kids, ["Child A", "Child B"]);
  });

  it("HeadingOutlineProvider skips headings inside fenced code blocks", async () => {
    await openMarkdown("# Real heading\n\n```\n# Not a heading\n```\n\n# After fence");
    const provider = new HeadingOutlineProvider();
    const labels = provider.getChildren().map((r) => String(r.label));
    assert.deepStrictEqual(labels, ["Real heading", "After fence"]);
  });

  it("toggleLineLock is callable without throwing (two toggles round-trip)", async () => {
    await openMarkdown("any\ncontent");
    await run("lotion.toggleLineLock");
    await run("lotion.toggleLineLock");
    assert.ok(true);
  });

  it("bookmark commands are registered", async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("lotion.bookmarkPage"), "bookmarkPage missing");
    assert.ok(cmds.includes("lotion.removeBookmark"), "removeBookmark missing");
    assert.ok(cmds.includes("lotion.openBookmark"), "openBookmark missing");
  });
});
