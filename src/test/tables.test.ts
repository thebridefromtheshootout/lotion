import * as assert from "assert";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor } from "./_helpers";

describe("tables feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("tableAlign reformats column widths to a consistent grid", async () => {
    // Aligner pads columns to a minimum width — single-char cells become 3.
    const editor = await openMarkdown("| a | bb |\n|---|---|\n| 1 | 22 |");
    setCursor(editor, 2, 2);
    await run("lotion.tableAlign");
    assert.strictEqual(
      getText(editor),
      "| a   | bb  |\n| --- | --- |\n| 1   | 22  |",
    );
  });

  it("tableDeleteRow removes the data row under the cursor", async () => {
    const editor = await openMarkdown("| h |\n|---|\n| a |\n| b |");
    setCursor(editor, 2, 2);
    await run("lotion.tableDeleteRow");
    assert.strictEqual(getText(editor), "| h   |\n| --- |\n| b   |");
  });

  it("tableTabForward moves the cursor to the next cell", async () => {
    const editor = await openMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    setCursor(editor, 2, 2); // inside the '1' cell
    await run("lotion.tableTabForward");
    // Should now be inside the '2' cell — line 2, somewhere after the '|'
    assert.strictEqual(editor.selection.active.line, 2);
    assert.ok(
      editor.selection.active.character > 4,
      `expected cursor past column boundary, got col ${editor.selection.active.character}`,
    );
  });

  it("tableTabForward at end of last row stays put", async () => {
    const editor = await openMarkdown("| h |\n|---|\n| x |");
    setCursor(editor, 2, 2);
    await run("lotion.tableTabForward");
    // Single-cell single-row table — there's no next cell.
    assert.strictEqual(editor.selection.active.line, 2);
  });

  it("tableTranspose swaps rows and columns", async () => {
    const editor = await openMarkdown("| h1 | h2 |\n|----|----|\n| a  | b  |\n| c  | d  |");
    setCursor(editor, 0, 2);
    await run("lotion.tableTranspose");
    // After transpose: original headers become first column; data becomes columns.
    // h1 row: h1 | a | c
    // h2 row: h2 | b | d
    // The first header cell becomes the new top-left header.
    const text = getText(editor);
    assert.ok(/^\| h1\s+\|/m.test(text), `expected h1 row, got:\n${text}`);
    assert.ok(/^\| h2\s+\|/m.test(text), `expected h2 row, got:\n${text}`);
    assert.ok(text.includes("a") && text.includes("d"), `transposed cells preserved`);
  });
});
