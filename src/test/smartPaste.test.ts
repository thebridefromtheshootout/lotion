import * as assert from "assert";
import * as vscode from "vscode";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor, setSelection } from "./_helpers";

// Smart-paste's auto-link branch wraps a clipboard URL with the
// active selection as label. Title-fetching is skipped when a label is
// supplied, so these tests don't depend on network access.

describe("smart paste feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
    await vscode.env.clipboard.writeText("");
  });

  it("wraps a selection with a URL on the clipboard as an HTML anchor", async () => {
    const editor = await openMarkdown("Read the docs here.");
    setSelection(editor, 0, 9, 0, 13); // "docs"
    await vscode.env.clipboard.writeText("https://example.com/docs");
    await run("lotion.smartPaste");
    assert.strictEqual(
      getText(editor),
      'Read the <a href="https://example.com/docs">docs</a> here.',
    );
  });

  it("wraps a selection with an image URL on the clipboard as an <img>", async () => {
    const editor = await openMarkdown("see logo here.");
    setSelection(editor, 0, 4, 0, 8); // "logo"
    await vscode.env.clipboard.writeText("https://example.com/logo.png");
    await run("lotion.smartPaste");
    assert.strictEqual(
      getText(editor),
      'see <img src="https://example.com/logo.png" alt="logo"> here.',
    );
  });

  it("falls back to default paste when the clipboard is plain text and there is no selection", async () => {
    const editor = await openMarkdown("hello ");
    setCursor(editor, 0, 6);
    await vscode.env.clipboard.writeText("world");
    await run("lotion.smartPaste");
    assert.strictEqual(getText(editor), "hello world");
  });

  it("inside a fenced code block, smart paste inserts a URL literally — no anchor wrap", async () => {
    const editor = await openMarkdown("```ts\n\n```");
    setCursor(editor, 1, 0); // cursor inside the fence
    await vscode.env.clipboard.writeText("https://example.com");
    await run("lotion.smartPaste");
    assert.strictEqual(getText(editor), "```ts\nhttps://example.com\n```");
  });

  it("lotion.smartPaste and lotion.insertImage are registered", async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("lotion.smartPaste"));
    assert.ok(cmds.includes("lotion.insertImage"));
  });

  it("tab-separated clipboard text becomes a markdown table on smart paste", async () => {
    const editor = await openMarkdown("");
    setCursor(editor, 0, 0);
    await vscode.env.clipboard.writeText("h1\th2\na\tb\nc\td");
    await run("lotion.smartPaste");
    const lines = getText(editor).split("\n");
    assert.ok(/^\| h1\s+\| h2\s+\|$/.test(lines[0]), `header row, got: ${lines[0]}`);
    assert.ok(/^\| -+ \| -+ \|$/.test(lines[1]), `separator row, got: ${lines[1]}`);
    assert.ok(/^\| a\s+\| b\s+\|$/.test(lines[2]));
    assert.ok(/^\| c\s+\| d\s+\|$/.test(lines[3]));
  });

  it("CSV clipboard with 2+ columns becomes a markdown table on smart paste", async () => {
    const editor = await openMarkdown("");
    setCursor(editor, 0, 0);
    await vscode.env.clipboard.writeText("h1,h2,h3\n1,2,3\n4,5,6");
    await run("lotion.smartPaste");
    const lines = getText(editor).split("\n");
    assert.ok(/^\| h1\s+\| h2\s+\| h3\s+\|$/.test(lines[0]));
    assert.strictEqual(lines.length, 4);
  });

  it("plain prose on the clipboard (no tabs/commas) falls through to default paste", async () => {
    const editor = await openMarkdown("");
    setCursor(editor, 0, 0);
    await vscode.env.clipboard.writeText("Just a sentence with no structure.");
    await run("lotion.smartPaste");
    assert.strictEqual(getText(editor), "Just a sentence with no structure.");
  });
});
