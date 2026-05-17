import * as assert from "assert";
import * as vscode from "vscode";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor, stubInputBox } from "./_helpers";

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

  it("tableAddRowsAbove inserts N empty rows above the cursor", async () => {
    const editor = await openMarkdown("| h |\n|---|\n| a |");
    setCursor(editor, 2, 2);
    const stub = stubInputBox("2");
    try {
      await run("lotion.tableAddRowsAbove");
    } finally {
      stub.dispose();
    }
    // Original 3 lines + 2 inserted above the data row.
    const lines = getText(editor).split("\n");
    assert.strictEqual(lines.length, 5);
    // Header + separator stay first; cursor's data row is last.
    assert.ok(/^\| h\s+\|$/.test(lines[0]));
    assert.ok(/^\| -+ \|$/.test(lines[1]));
    assert.ok(/^\| a\s+\|$/.test(lines[4]));
  });

  it("tableAddColsRight adds a column to the right of the cursor", async () => {
    const editor = await openMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    setCursor(editor, 0, 2); // inside col 'a'
    const stub = stubInputBox("1");
    try {
      await run("lotion.tableAddColsRight");
    } finally {
      stub.dispose();
    }
    const lines = getText(editor).split("\n");
    // Now three columns wide.
    assert.strictEqual(lines[0].match(/\|/g)!.length, 4);
  });

  it("tableDeleteCol removes the column under the cursor", async () => {
    const editor = await openMarkdown("| a | b | c |\n|---|---|---|\n| 1 | 2 | 3 |");
    setCursor(editor, 0, 6); // inside col 'b'
    await run("lotion.tableDeleteCol");
    const lines = getText(editor).split("\n");
    // Two columns remain.
    assert.strictEqual(lines[0].match(/\|/g)!.length, 3);
    assert.ok(!lines[0].includes("b"), `column 'b' should be gone: ${lines[0]}`);
  });

  it("tableTabBackward moves the cursor to the previous cell", async () => {
    const editor = await openMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    setCursor(editor, 2, 7); // inside the '2' cell
    await run("lotion.tableTabBackward");
    assert.strictEqual(editor.selection.active.line, 2);
    assert.ok(
      editor.selection.active.character < 5,
      `expected cursor before column boundary, got col ${editor.selection.active.character}`,
    );
  });

  it("tableCopyColumn copies a structured column payload to the clipboard", async () => {
    const editor = await openMarkdown("| h1 | h2 |\n|----|----|\n| a  | x  |\n| b  | y  |");
    setCursor(editor, 2, 2); // inside col h1
    await run("lotion.tableCopyColumn");
    const clip = JSON.parse(await vscode.env.clipboard.readText());
    assert.strictEqual(clip.__lotionTableColumn, true);
    assert.strictEqual(clip.header, "h1");
    assert.deepStrictEqual(clip.rows, ["a", "b"]);
  });
});
