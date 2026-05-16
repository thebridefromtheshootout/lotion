import * as assert from "assert";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor } from "./_helpers";

// Slash commands that do not require an interactive picker/input — those
// (e.g. /callout, /code, /today, /table) need a separate stubbing story
// and are covered in a later pass.
describe("editor slash commands (no-UI)", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("/toggle inserts a <details>/<summary> block, eating the trigger slash", async () => {
    const editor = await openMarkdown("/");
    setCursor(editor, 0, 1);
    await run("lotion.insertToggle");
    assert.strictEqual(
      getText(editor),
      "<details>\n<summary>Summary</summary>\n\n\n\n</details>",
    );
  });

  it("/th1 inserts a toggle wrapping an <h1> summary", async () => {
    const editor = await openMarkdown("/");
    setCursor(editor, 0, 1);
    await run("lotion.insertToggleH1");
    assert.strictEqual(
      getText(editor),
      "<details>\n<summary><h1>Heading</h1></summary>\n\n\n\n</details>",
    );
  });

  it("/footnote appends a numbered definition and inserts the ref at cursor", async () => {
    const editor = await openMarkdown("Some prose.");
    setCursor(editor, 0, 11);
    await run("lotion.insertFootnote");
    assert.strictEqual(getText(editor), "Some prose.[^1]\n\n[^1]: \n");
  });

  it("/toc builds a TOC fenced by sentinel comments from existing headings", async () => {
    const editor = await openMarkdown("# Title\n\n## Sub\n\n/");
    setCursor(editor, 4, 1);
    await run("lotion.insertToc");
    assert.strictEqual(
      getText(editor),
      "# Title\n\n## Sub\n\n<!-- toc-start -->\n- [Title](#title)\n  - [Sub](#sub)\n<!-- toc-end -->",
    );
  });

  it("/section inserts the divider + heading scaffold", async () => {
    const editor = await openMarkdown("/");
    setCursor(editor, 0, 1);
    await run("lotion.insertSection");
    assert.strictEqual(getText(editor), "---\n### \n\n---");
  });
});
