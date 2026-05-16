import * as assert from "assert";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor, stubInputBox, stubQuickPick } from "./_helpers";

// Slash commands that gate on showQuickPick / showInputBox. We stub the
// UI to canned values so the behavioural tail of each command runs.

describe("picker-driven slash commands", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("/callout inserts a > [!NOTE] block after stubbing the picker", async () => {
    const editor = await openMarkdown("/");
    setCursor(editor, 0, 1);
    const stub = stubQuickPick({ label: "ℹ️  NOTE", description: "Informational callout", id: "NOTE" });
    try {
      await run("lotion.insertCallout");
    } finally {
      stub.dispose();
    }
    assert.strictEqual(getText(editor), "> [!NOTE]\n> ");
  });

  it("/code inserts a fenced block with the chosen language", async () => {
    const editor = await openMarkdown("/");
    setCursor(editor, 0, 1);
    const stub = stubQuickPick("typescript");
    try {
      await run("lotion.insertCodeBlock");
    } finally {
      stub.dispose();
    }
    assert.strictEqual(getText(editor), "```typescript\n\n```");
  });

  it("/today inserts a formatted date when the user picks a format", async () => {
    const editor = await openMarkdown("");
    setCursor(editor, 0, 0);
    const stub = stubQuickPick({ label: "2026-05-16", fmt: "YYYY-MM-DD" });
    try {
      await run("lotion.insertToday");
    } finally {
      stub.dispose();
    }
    assert.strictEqual(getText(editor), "2026-05-16");
  });

  it("/table inserts a grid sized from the InputBox prompt (2x1)", async () => {
    const editor = await openMarkdown("/");
    setCursor(editor, 0, 1);
    const stub = stubInputBox("2x1");
    try {
      await run("lotion.insertTable");
    } finally {
      stub.dispose();
    }
    // Two columns named Col 1 / Col 2, one data row.
    const text = getText(editor);
    assert.ok(/\| Col 1 \| Col 2 \|/.test(text), `headers missing in: ${text}`);
    assert.ok(/\| -+ \| -+ \|/.test(text), `separator row missing in: ${text}`);
  });

  it("tableAddRowsBelow appends N empty rows when the InputBox returns N", async () => {
    const editor = await openMarkdown("| h |\n|---|\n| a |");
    setCursor(editor, 2, 2);
    const stub = stubInputBox("2");
    try {
      await run("lotion.tableAddRowsBelow");
    } finally {
      stub.dispose();
    }
    const lines = getText(editor).split("\n");
    // Original 3 lines + 2 new data rows.
    assert.strictEqual(lines.length, 5, `expected 5 lines, got ${lines.length}:\n${getText(editor)}`);
  });
});
