import * as assert from "assert";
import * as vscode from "vscode";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor, setSelection } from "./_helpers";

describe("blocks feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("duplicateBlock copies the current paragraph below it", async () => {
    const editor = await openMarkdown("Para A line 1.\nPara A line 2.\n\nPara B.");
    setCursor(editor, 0, 0);
    await run("lotion.duplicateBlock");
    assert.strictEqual(
      getText(editor),
      "Para A line 1.\nPara A line 2.\nPara A line 1.\nPara A line 2.\n\nPara B.",
    );
  });

  it("swapBlockDown swaps the current paragraph with the next one", async () => {
    // swapBlock collapses a single blank-line separator into a plain newline
    // join — capturing current behaviour rather than the ideal.
    const editor = await openMarkdown("Top block.\n\nBottom block.");
    setCursor(editor, 0, 0);
    await run("lotion.swapBlockDown");
    assert.strictEqual(getText(editor), "Bottom block.\nTop block.");
  });

  it("swapBlockUp is a no-op when already at the document top", async () => {
    const editor = await openMarkdown("Top.\n\nBottom.");
    setCursor(editor, 0, 0);
    await run("lotion.swapBlockUp");
    assert.strictEqual(getText(editor), "Top.\n\nBottom.");
  });

  it("selectBlock extends the selection across the current paragraph", async () => {
    const editor = await openMarkdown("Line one.\nLine two.\nLine three.\n\nNext block.");
    setCursor(editor, 1, 0);
    await run("lotion.selectBlock");
    const sel = editor.selection;
    assert.strictEqual(sel.start.line, 0);
    assert.strictEqual(sel.start.character, 0);
    assert.strictEqual(sel.end.line, 2);
    assert.strictEqual(sel.end.character, "Line three.".length);
  });

  it("selectBlock spans a fenced code block including the fences", async () => {
    const editor = await openMarkdown("Before.\n\n```ts\nconst x = 1;\n```\n\nAfter.");
    setCursor(editor, 3, 0); // cursor inside the fenced block
    await run("lotion.selectBlock");
    const selected = editor.document.getText(editor.selection);
    assert.strictEqual(selected, "```ts\nconst x = 1;\n```");
    // sanity: assert ends are at the fence lines
    assert.strictEqual(editor.selection.start.line, 2);
    assert.strictEqual(editor.selection.end.line, 4);
    void vscode; // suppress unused if imports change
  });
});
