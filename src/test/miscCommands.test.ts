import * as assert from "assert";
import * as vscode from "vscode";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor } from "./_helpers";

describe("miscellaneous command coverage", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("/secretbox inserts a <details> block carrying the secretbox HTML marker", async () => {
    const editor = await openMarkdown("/");
    setCursor(editor, 0, 1);
    await run("lotion.insertSecretbox");
    const text = getText(editor);
    assert.ok(text.startsWith("<details><!--lotion-secretbox-->"), `unexpected output: ${text}`);
    assert.ok(text.includes("<summary>Secret title</summary>"));
    assert.ok(text.trimEnd().endsWith("</details>"));
  });

  it("lockBlock / unlockBlock commands are registered for use inside secret boxes", async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("lotion.lockBlock"), "lockBlock missing");
    assert.ok(cmds.includes("lotion.unlockBlock"), "unlockBlock missing");
    assert.ok(cmds.includes("lotion.insertSecretbox"), "insertSecretbox missing");
  });

  it("comment + frontmatter commands are registered", async () => {
    const cmds = await vscode.commands.getCommands(true);
    for (const id of [
      "lotion.addComment",
      "lotion.showCommentPanel",
      "lotion.editFrontmatter",
    ]) {
      assert.ok(cmds.includes(id), `${id} should be registered`);
    }
  });

  it("page-management commands are registered (create / rename / move / quick-switch)", async () => {
    const cmds = await vscode.commands.getCommands(true);
    for (const id of [
      "lotion.createPage",
      "lotion.renamePage",
      "lotion.movePage",
      "lotion.quickSwitch",
      "lotion.extractToSubpage",
      "lotion.findOrphanPages",
    ]) {
      assert.ok(cmds.includes(id), `${id} should be registered`);
    }
  });

  it("media + emoji + gif slash commands are registered", async () => {
    const cmds = await vscode.commands.getCommands(true);
    for (const id of [
      "lotion.insertImage",
      "lotion.insertResource",
      "lotion.insertGif",
      "lotion.insertEmoji",
    ]) {
      assert.ok(cmds.includes(id), `${id} should be registered`);
    }
  });
});
