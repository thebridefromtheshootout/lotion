import * as assert from "assert";
import { activate, closeAllEditors, getText, openMarkdown, run, setCursor, setSelection } from "./_helpers";

describe("lists feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  describe("listContinue (Enter)", () => {
    it("continues an unordered list with the same marker", async () => {
      const editor = await openMarkdown("- one");
      setCursor(editor, 0, 5);
      await run("lotion.listContinue");
      assert.strictEqual(getText(editor), "- one\n- ");
    });

    it("clears the marker on an empty unordered item", async () => {
      const editor = await openMarkdown("- ");
      setCursor(editor, 0, 2);
      await run("lotion.listContinue");
      assert.strictEqual(getText(editor), "");
    });

    it("increments and renumbers an ordered list", async () => {
      const editor = await openMarkdown("1. one\n2. two");
      setCursor(editor, 0, 6); // end of "1. one"
      await run("lotion.listContinue");
      assert.strictEqual(getText(editor), "1. one\n2. \n3. two");
    });

    it("continues a checkbox item as unchecked", async () => {
      const editor = await openMarkdown("- [x] done");
      setCursor(editor, 0, 10);
      await run("lotion.listContinue");
      assert.strictEqual(getText(editor), "- [x] done\n- [ ] ");
    });
  });

  describe("toggleCheckbox", () => {
    it("converts a bullet item to an unchecked checkbox", async () => {
      const editor = await openMarkdown("- task");
      setCursor(editor, 0, 0);
      await run("lotion.toggleCheckbox");
      assert.strictEqual(getText(editor), "- [ ] task");
    });

    it("checks an unchecked checkbox", async () => {
      const editor = await openMarkdown("- [ ] task");
      setCursor(editor, 0, 0);
      await run("lotion.toggleCheckbox");
      assert.strictEqual(getText(editor), "- [x] task");
    });

    it("unchecks a checked checkbox", async () => {
      const editor = await openMarkdown("- [x] task");
      setCursor(editor, 0, 0);
      await run("lotion.toggleCheckbox");
      assert.strictEqual(getText(editor), "- [ ] task");
    });
  });

  describe("renumber", () => {
    it("fixes broken numbering across an ordered list", async () => {
      const editor = await openMarkdown("1. one\n5. two\n9. three");
      setCursor(editor, 0, 0);
      await run("lotion.renumberList");
      assert.strictEqual(getText(editor), "1. one\n2. two\n3. three");
    });
  });

  describe("ol ↔ ul conversion", () => {
    it("olToUl replaces numbered markers with bullets", async () => {
      const editor = await openMarkdown("1. a\n2. b\n3. c");
      setCursor(editor, 1, 0);
      await run("lotion.olToUl");
      assert.strictEqual(getText(editor), "- a\n- b\n- c");
    });

    it("ulToOl replaces bullet markers with numbers", async () => {
      const editor = await openMarkdown("- a\n- b\n- c");
      setCursor(editor, 1, 0);
      await run("lotion.ulToOl");
      assert.strictEqual(getText(editor), "1. a\n2. b\n3. c");
    });
  });

  describe("indent / outdent", () => {
    it("indents the current list item with two spaces", async () => {
      const editor = await openMarkdown("- parent\n- child");
      setCursor(editor, 1, 0);
      await run("lotion.indentList");
      assert.strictEqual(getText(editor), "- parent\n  - child");
    });

    it("outdents the current list item back to root", async () => {
      const editor = await openMarkdown("- parent\n  - child");
      setCursor(editor, 1, 4);
      await run("lotion.outdentList");
      assert.strictEqual(getText(editor), "- parent\n- child");
    });

    it("indenting an unparented ordered item demotes it to a bullet", async () => {
      const editor = await openMarkdown("1. parent\n2. child");
      setCursor(editor, 1, 0);
      await run("lotion.indentList");
      // No marker exists at the deeper indent above us, so the demoted
      // item adopts a fresh bullet rather than inventing a new ordered list.
      assert.strictEqual(getText(editor), "1. parent\n  - child");
    });
  });

  describe("multi-line selection checkbox", () => {
    it("toggles checkboxes across the selection", async () => {
      const editor = await openMarkdown("- a\n- b\n- c");
      setSelection(editor, 0, 0, 2, 3);
      await run("lotion.toggleCheckbox");
      assert.strictEqual(getText(editor), "- [ ] a\n- [ ] b\n- [ ] c");
    });
  });
});
