import * as assert from "assert";
import { activate, closeAllEditors, openMarkdown, run, setCursor } from "./_helpers";

describe("navigation feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("jumpToNextHeading moves the cursor to the next heading line", async () => {
    const editor = await openMarkdown("intro\n# First\nsome text\n## Second\nbody");
    setCursor(editor, 0, 0);
    await run("lotion.jumpToNextHeading");
    assert.strictEqual(editor.selection.active.line, 1);
  });

  it("jumpToNextHeading wraps to the top when no heading follows", async () => {
    const editor = await openMarkdown("# Only\nbody line");
    setCursor(editor, 1, 0);
    await run("lotion.jumpToNextHeading");
    assert.strictEqual(editor.selection.active.line, 0);
  });

  it("jumpToPrevHeading moves the cursor to the previous heading line", async () => {
    const editor = await openMarkdown("# First\nbody\n## Second\nmore");
    setCursor(editor, 3, 0);
    await run("lotion.jumpToPrevHeading");
    assert.strictEqual(editor.selection.active.line, 2);
  });

  it("revealHeading positions the cursor at the given line", async () => {
    const editor = await openMarkdown("# A\nbody\n## B\nmore\n### C");
    setCursor(editor, 0, 0);
    await run("lotion.revealHeading", 4);
    assert.strictEqual(editor.selection.active.line, 4);
    assert.strictEqual(editor.selection.active.character, 0);
  });

  it("refreshOutline is a callable command (no throw)", async () => {
    await openMarkdown("# heading");
    await run("lotion.refreshOutline");
    // No assertion on output — we're verifying the command doesn't throw.
    assert.ok(true);
  });
});
