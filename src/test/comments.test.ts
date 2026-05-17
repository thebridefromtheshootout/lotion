import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { resolveComment } from "../editor/comments/commentCommands";
import { loadComments } from "../editor/comments/commentModel";
import { activate, closeAllEditors, createFixture, removeFixture, run, setSelection, stubInputBox, writeFixtureFile } from "./_helpers";

describe("comments feature", () => {
  before(async () => {
    await activate();
    // Pre-set the comment author so addComment doesn't prompt for one.
    const cfg = vscode.workspace.getConfiguration("lotion");
    await cfg.update("commentUsername", "tester", vscode.ConfigurationTarget.Workspace);
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("addComment writes the comment to <docDir>/.rsrc/comments.json", async () => {
    const dir = createFixture("comments-add");
    try {
      const file = path.join(dir, "page.md");
      writeFixtureFile(file, "Some prose to comment on.");
      const doc = await vscode.workspace.openTextDocument(file);
      const editor = await vscode.window.showTextDocument(doc);
      setSelection(editor, 0, 0, 0, 4); // "Some"

      const stub = stubInputBox("This is the body of the comment.");
      try {
        await run("lotion.addComment");
      } finally {
        stub.dispose();
      }

      const comments = loadComments(file);
      assert.strictEqual(comments.length, 1, "exactly one comment");
      assert.strictEqual(comments[0].body, "This is the body of the comment.");
      assert.strictEqual(comments[0].author, "tester");
      assert.strictEqual(comments[0].anchorText, "Some");
      assert.ok(
        doc.getText().includes(`<!--lotion-comment:${comments[0].id}-->`),
        "marker should be present in the document",
      );
    } finally {
      removeFixture(dir);
    }
  });

  it("addComment with an empty selection is a no-op (just a warning)", async () => {
    const dir = createFixture("comments-no-sel");
    try {
      const file = path.join(dir, "page.md");
      writeFixtureFile(file, "Nothing selected here.");
      const doc = await vscode.workspace.openTextDocument(file);
      await vscode.window.showTextDocument(doc);
      await run("lotion.addComment");
      assert.strictEqual(loadComments(file).length, 0);
    } finally {
      removeFixture(dir);
    }
  });

  it("resolveComment toggles the resolved flag on the stored entry", async () => {
    const dir = createFixture("comments-resolve");
    try {
      const file = path.join(dir, "page.md");
      writeFixtureFile(file, "Prose.");
      const doc = await vscode.workspace.openTextDocument(file);
      const editor = await vscode.window.showTextDocument(doc);
      setSelection(editor, 0, 0, 0, 5);

      const stub = stubInputBox("To be resolved.");
      try {
        await run("lotion.addComment");
      } finally {
        stub.dispose();
      }

      const before = loadComments(file)[0];
      assert.ok(!before.resolved, "starts unresolved");
      await resolveComment(file, before.id);
      assert.strictEqual(loadComments(file)[0].resolved, true);
      await resolveComment(file, before.id);
      assert.strictEqual(loadComments(file)[0].resolved, false);
    } finally {
      removeFixture(dir);
    }
  });

  it("comments.json lives under the same dir as the doc, in .rsrc/", async () => {
    const dir = createFixture("comments-path");
    try {
      const file = path.join(dir, "page.md");
      writeFixtureFile(file, "Anchor.");
      const doc = await vscode.workspace.openTextDocument(file);
      const editor = await vscode.window.showTextDocument(doc);
      setSelection(editor, 0, 0, 0, 6);

      const stub = stubInputBox("c1");
      try {
        await run("lotion.addComment");
      } finally {
        stub.dispose();
      }

      assert.ok(fs.existsSync(path.join(dir, ".rsrc", "comments.json")));
    } finally {
      removeFixture(dir);
    }
  });

  it("showCommentPanel and addComment commands are registered", async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("lotion.addComment"));
    assert.ok(cmds.includes("lotion.showCommentPanel"));
  });
});
