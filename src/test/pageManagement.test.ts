import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { activate, closeAllEditors, createFixture, removeFixture, run, setCursor, stubInputBox, writeFixtureFile } from "./_helpers";

describe("page management feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("createPage creates <slug>/index.md and inserts a markdown link into the active doc", async () => {
    const dir = createFixture("page-create");
    try {
      const parentFile = path.join(dir, "index.md");
      writeFixtureFile(parentFile, "/");
      const doc = await vscode.workspace.openTextDocument(parentFile);
      const editor = await vscode.window.showTextDocument(doc);
      // Cursor at col 1 so triggerRange.translate(0,-1) eats the slash.
      setCursor(editor, 0, 1);

      const stub = stubInputBox("My New Page");
      try {
        await run("lotion.createPage");
      } finally {
        stub.dispose();
      }

      const childPath = path.join(dir, "my-new-page", "index.md");
      assert.ok(fs.existsSync(childPath), `expected ${childPath} to exist`);
      // The child file starts with the page heading.
      assert.ok(
        fs.readFileSync(childPath, "utf-8").startsWith("# My New Page\n"),
        "child file should open with the page H1",
      );
      // The parent should now contain a link to the child (replacing the trigger slash).
      const parentAfter = fs.readFileSync(parentFile, "utf-8");
      assert.ok(
        parentAfter.includes("[My New Page](my-new-page/index.md)"),
        `parent should link to the child, got:\n${parentAfter}`,
      );
    } finally {
      removeFixture(dir);
    }
  });

  it("createPage cancels cleanly when the user dismisses the input box", async () => {
    const dir = createFixture("page-cancel");
    try {
      const parentFile = path.join(dir, "index.md");
      writeFixtureFile(parentFile, "/");
      const doc = await vscode.workspace.openTextDocument(parentFile);
      const editor = await vscode.window.showTextDocument(doc);
      setCursor(editor, 0, 1);

      const stub = stubInputBox(undefined); // simulate cancel
      try {
        await run("lotion.createPage");
      } finally {
        stub.dispose();
      }

      // No subdirs should appear.
      const entries = fs.readdirSync(dir);
      assert.deepStrictEqual(entries.sort(), ["index.md"]);
    } finally {
      removeFixture(dir);
    }
  });

  it("renamePage warns and bails on non-index.md files", async () => {
    const dir = createFixture("page-rename-nonidx");
    try {
      const file = path.join(dir, "page.md");
      writeFixtureFile(file, "# Page");
      const doc = await vscode.workspace.openTextDocument(file);
      await vscode.window.showTextDocument(doc);
      // No prompt should fire because renamePage exits early; we don't stub.
      await run("lotion.renamePage");
      assert.ok(fs.existsSync(file), "original file untouched");
    } finally {
      removeFixture(dir);
    }
  });

  it("page-management commands are all registered", async () => {
    const cmds = await vscode.commands.getCommands(true);
    for (const id of [
      "lotion.createPage",
      "lotion.renamePage",
      "lotion.movePage",
      "lotion.quickSwitch",
      "lotion.findOrphanPages",
      "lotion.extractToSubpage",
    ]) {
      assert.ok(cmds.includes(id), `${id} should be registered`);
    }
  });

  it("createPage builds a kebab-case slug from a multi-word name", async () => {
    const dir = createFixture("page-slug");
    try {
      const parentFile = path.join(dir, "index.md");
      writeFixtureFile(parentFile, "/");
      const doc = await vscode.workspace.openTextDocument(parentFile);
      const editor = await vscode.window.showTextDocument(doc);
      setCursor(editor, 0, 1);

      const stub = stubInputBox("Some Multi Word Title");
      try {
        await run("lotion.createPage");
      } finally {
        stub.dispose();
      }

      assert.ok(fs.existsSync(path.join(dir, "some-multi-word-title", "index.md")));
    } finally {
      removeFixture(dir);
    }
  });
});
