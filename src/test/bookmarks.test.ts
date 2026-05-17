import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { activate, closeAllEditors, run, workspaceRoot } from "./_helpers";

// Bookmarks live in .vscode/lotion-bookmarks.json relative to the
// workspace root. Each test uses a unique filename + cleans the file
// state up afterwards so runs don't pollute each other.
function bookmarksFilePath(): string {
  return path.join(workspaceRoot(), ".vscode", "lotion-bookmarks.json");
}

function readBookmarks(): { path: string; label?: string }[] {
  try {
    return JSON.parse(fs.readFileSync(bookmarksFilePath(), "utf-8"));
  } catch {
    return [];
  }
}

function resetBookmarks(): void {
  fs.rmSync(bookmarksFilePath(), { force: true });
}

async function openPage(name: string): Promise<vscode.Uri> {
  const file = path.join(workspaceRoot(), name);
  fs.writeFileSync(file, "# Sample page\n", "utf-8");
  const uri = vscode.Uri.file(file);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  return uri;
}

describe("bookmarks feature", () => {
  before(async () => {
    await activate();
  });
  beforeEach(() => {
    resetBookmarks();
  });
  afterEach(async () => {
    await closeAllEditors();
    resetBookmarks();
  });

  it("bookmarkPage records the active markdown file using a workspace-relative path", async () => {
    const fileName = `bookmark-fixture-${Date.now()}.md`;
    await openPage(fileName);
    await run("lotion.bookmarkPage");
    const entries = readBookmarks();
    assert.strictEqual(entries.length, 1, "exactly one bookmark");
    assert.strictEqual(entries[0].path, fileName);
    fs.rmSync(path.join(workspaceRoot(), fileName), { force: true });
  });

  it("bookmarkPage is idempotent — the same page only gets recorded once", async () => {
    const fileName = `bookmark-idem-${Date.now()}.md`;
    await openPage(fileName);
    await run("lotion.bookmarkPage");
    await run("lotion.bookmarkPage");
    assert.strictEqual(readBookmarks().length, 1);
    fs.rmSync(path.join(workspaceRoot(), fileName), { force: true });
  });

  it("removeBookmark and openBookmark are registered as commands", async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("lotion.removeBookmark"));
    assert.ok(cmds.includes("lotion.openBookmark"));
  });

  it("the bookmarks JSON file uses forward slashes even on a nested file", async () => {
    const fileName = `nested-${Date.now()}/page.md`;
    fs.mkdirSync(path.dirname(path.join(workspaceRoot(), fileName)), { recursive: true });
    await openPage(fileName);
    await run("lotion.bookmarkPage");
    const entry = readBookmarks()[0];
    assert.ok(entry.path.includes("/"), `expected forward slash, got: ${entry.path}`);
    fs.rmSync(path.join(workspaceRoot(), path.dirname(fileName)), { recursive: true, force: true });
  });

  it("two different pages produce two distinct bookmarks", async () => {
    const a = `bookmark-a-${Date.now()}.md`;
    const b = `bookmark-b-${Date.now()}.md`;
    await openPage(a);
    await run("lotion.bookmarkPage");
    await openPage(b);
    await run("lotion.bookmarkPage");
    const entries = readBookmarks();
    assert.strictEqual(entries.length, 2);
    const paths = entries.map((e) => e.path);
    assert.ok(paths.includes(a));
    assert.ok(paths.includes(b));
    fs.rmSync(path.join(workspaceRoot(), a), { force: true });
    fs.rmSync(path.join(workspaceRoot(), b), { force: true });
  });
});
