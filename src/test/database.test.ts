import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { cursorInDb, cursorInDbEntry, isDbFile, findParentDbIndex, invalidateDbFileCache } from "../database/dbEntries";
import { activate, closeAllEditors, createFixture, removeFixture, run, stubInputBox, writeFixtureFile } from "./_helpers";

const SCHEMA = "```lotion-db\ncolumns:\n  - name: Title\n    type: text\n```\n\n1. [Existing](existing/index.md)\n";
const SCHEMA_WITH_NOTES = "```lotion-db\ncolumns:\n  - name: Notes\n    type: text\n```\n";

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

  it("cursorInDb is true on a DB index doc and false on a plain doc", async () => {
    const indexDoc = await vscode.workspace.openTextDocument({ content: SCHEMA, language: "markdown" });
    assert.strictEqual(cursorInDb(indexDoc, new vscode.Position(0, 0)), true);
    const plainDoc = await vscode.workspace.openTextDocument({ content: "# Just a page\n", language: "markdown" });
    assert.strictEqual(cursorInDb(plainDoc, new vscode.Position(0, 0)), false);
  });

  it("cursorInDbEntry is true for a doc that sits under a DB index", async () => {
    const dir = createFixture("db-cursor-entry");
    try {
      const indexPath = path.join(dir, "index.md");
      const entryPath = path.join(dir, "alpha", "index.md");
      writeFixtureFile(indexPath, SCHEMA);
      writeFixtureFile(entryPath, "# Alpha\n");
      invalidateDbFileCache(indexPath);
      const entryDoc = await vscode.workspace.openTextDocument(entryPath);
      assert.strictEqual(cursorInDbEntry(entryDoc, new vscode.Position(0, 0)), true);
    } finally {
      removeFixture(dir);
    }
  });

  it("isDbFile re-reads after invalidateDbFileCache when the file changes", () => {
    const dir = createFixture("db-cache");
    try {
      const file = path.join(dir, "index.md");
      writeFixtureFile(file, SCHEMA);
      invalidateDbFileCache(file);
      assert.strictEqual(isDbFile(file), true, "schema fence is recognised on first read");

      // Replace content with plain markdown (no schema).
      fs.writeFileSync(file, "# Just a page\n", "utf-8");
      invalidateDbFileCache(file);
      assert.strictEqual(isDbFile(file), false, "cache invalidation forces a fresh read");
    } finally {
      removeFixture(dir);
    }
  });

  it("dbAddEntry creates a slug/index.md and appends a link to the DB index", async () => {
    const dir = createFixture("db-add-entry");
    try {
      const indexPath = path.join(dir, "index.md");
      writeFixtureFile(indexPath, SCHEMA_WITH_NOTES);
      invalidateDbFileCache(indexPath);

      // Activate the DB index in the editor; dbAddEntry-with-no-args uses
      // the active editor as the context.
      const doc = await vscode.workspace.openTextDocument(indexPath);
      await vscode.window.showTextDocument(doc);

      // Two prompts in sequence: entry title, then the Notes column value.
      const stub = stubInputBox(["My Entry", "Some notes"]);
      try {
        await run("lotion.dbAddEntry");
      } finally {
        stub.dispose();
      }

      const entryPath = path.join(dir, "my-entry", "index.md");
      assert.ok(fs.existsSync(entryPath), `expected ${entryPath} to be created`);

      // Re-read the index from disk (it was saved by the handler after editing).
      const indexAfter = fs.readFileSync(indexPath, "utf-8");
      assert.ok(
        indexAfter.includes("[My Entry](my-entry/index.md)"),
        `index should link the new entry, got:\n${indexAfter}`,
      );
    } finally {
      removeFixture(dir);
    }
  });
});
