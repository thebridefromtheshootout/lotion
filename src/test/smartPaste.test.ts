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
});
