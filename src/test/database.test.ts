import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { isDbFile, findParentDbIndex, invalidateDbFileCache } from "../database/dbEntries";
import { activate, closeAllEditors, createFixture, removeFixture, writeFixtureFile } from "./_helpers";

const SCHEMA = "```lotion-db\ncolumns:\n  - name: Title\n    type: text\n```\n\n1. [Existing](existing/index.md)\n";

describe("database feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("isDbFile returns true for a file containing a lotion-db schema fence", () => {
    const dir = createFixture("db-isdb-true");
    try {
      const file = path.join(dir, "index.md");
      writeFixtureFile(file, SCHEMA);
      invalidateDbFileCache(file);
      assert.strictEqual(isDbFile(file), true);
    } finally {
      removeFixture(dir);
    }
  });

  it("isDbFile returns false for a plain markdown file", () => {
    const dir = createFixture("db-isdb-false");
    try {
      const file = path.join(dir, "page.md");
      writeFixtureFile(file, "# Just a page.\n\nNo schema here.");
      invalidateDbFileCache(file);
      assert.strictEqual(isDbFile(file), false);
    } finally {
      removeFixture(dir);
    }
  });

  it("findParentDbIndex finds the DB index for a child entry path", () => {
    const dir = createFixture("db-parent");
    try {
      const indexPath = path.join(dir, "index.md");
      const childPath = path.join(dir, "child", "index.md");
      writeFixtureFile(indexPath, SCHEMA);
      writeFixtureFile(childPath, "# Child\n");
      invalidateDbFileCache(indexPath);
      assert.strictEqual(findParentDbIndex(childPath), indexPath);
    } finally {
      removeFixture(dir);
    }
  });

  it("findParentDbIndex returns undefined for the DB index itself", () => {
    const dir = createFixture("db-self");
    try {
      const indexPath = path.join(dir, "index.md");
      writeFixtureFile(indexPath, SCHEMA);
      invalidateDbFileCache(indexPath);
      assert.strictEqual(findParentDbIndex(indexPath), undefined);
    } finally {
      removeFixture(dir);
    }
  });

  it("openDbWebview command is registered (smoke check)", async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("lotion.openDbWebview"), "lotion.openDbWebview should be registered");
  });
});
