import * as assert from "assert";
import { activate, closeAllEditors, getText, openMarkdown, run } from "./_helpers";

describe("links feature", () => {
  before(async () => {
    await activate();
  });
  afterEach(async () => {
    await closeAllEditors();
  });

  it("linksToReference converts inline links and appends definitions", async () => {
    const editor = await openMarkdown("See [docs](https://example.com/docs).");
    await run("lotion.linksToReference");
    assert.strictEqual(
      getText(editor),
      "See [docs][1].\n\n[1]: https://example.com/docs\n",
    );
  });

  it("linksToReference deduplicates the same URL across multiple links", async () => {
    const editor = await openMarkdown(
      "[a](https://x.com) and [b](https://x.com) and [c](https://y.com).",
    );
    await run("lotion.linksToReference");
    assert.strictEqual(
      getText(editor),
      "[a][1] and [b][1] and [c][2].\n\n[1]: https://x.com\n[2]: https://y.com\n",
    );
  });

  it("linksToInline rewrites reference-style links back to inline", async () => {
    const editor = await openMarkdown(
      "See [docs][1].\n\n[1]: https://example.com/docs\n",
    );
    await run("lotion.linksToInline");
    assert.strictEqual(getText(editor), "See [docs](https://example.com/docs).\n");
  });

  it("inline → reference → inline is a round-trip", async () => {
    const source = "See [docs](https://example.com/docs).";
    const editor = await openMarkdown(source);
    await run("lotion.linksToReference");
    await run("lotion.linksToInline");
    // The round-trip can leave a trailing newline from the append/remove dance;
    // assert the content matches modulo that.
    assert.strictEqual(getText(editor).trimEnd(), source);
  });

  it("linksToReference numbers refs sequentially in document order", async () => {
    const editor = await openMarkdown(
      "[first](https://a.com) then [second](https://b.com).",
    );
    await run("lotion.linksToReference");
    assert.strictEqual(
      getText(editor),
      "[first][1] then [second][2].\n\n[1]: https://a.com\n[2]: https://b.com\n",
    );
  });
});
