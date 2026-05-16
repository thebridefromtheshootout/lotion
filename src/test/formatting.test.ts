import * as assert from "assert";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor, setSelection } from "./_helpers";

describe("formatting feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("toggleBold wraps the selection with **", async () => {
    const editor = await openMarkdown("hello world");
    setSelection(editor, 0, 0, 0, 5);
    await run("lotion.toggleBold");
    assert.strictEqual(getText(editor), "**hello** world");
  });

  it("toggleItalic unwraps an already-italicised selection", async () => {
    const editor = await openMarkdown("*hello* world");
    setSelection(editor, 0, 0, 0, 7);
    await run("lotion.toggleItalic");
    assert.strictEqual(getText(editor), "hello world");
  });

  it("toggleInlineCode wraps the selection with backticks", async () => {
    const editor = await openMarkdown("call foo() here");
    setSelection(editor, 0, 5, 0, 10);
    await run("lotion.toggleInlineCode");
    assert.strictEqual(getText(editor), "call `foo()` here");
  });

  it("demoteHeading adds one # to the heading line", async () => {
    const editor = await openMarkdown("## Section");
    setCursor(editor, 0, 0);
    await run("lotion.demoteHeading");
    assert.strictEqual(getText(editor), "### Section");
  });

  it("promoteHeading removes one # but never below H1", async () => {
    const editor = await openMarkdown("### Sub\n# Top");
    setSelection(editor, 0, 0, 1, 5);
    await run("lotion.promoteHeading");
    assert.strictEqual(getText(editor), "## Sub\n# Top");
  });
});
