import { parseTemplate } from "../database/dbTemplates";

// ═══════════════════════════════════════════════════════════════════
// parseTemplate
// ═══════════════════════════════════════════════════════════════════

describe("parseTemplate", () => {
  it("extracts defaults from a property table + body that follows", () => {
    const content = [
      "| Property | Value  |",
      "| -------- | ------ |",
      "| type     | bug    |",
      "| priority | medium |",
      "",
      "## Repro",
      "",
      "## Expected",
    ].join("\n");

    const result = parseTemplate(content);
    expect(result.defaults).toEqual({ type: "bug", priority: "medium" });
    expect(result.body).toBe("## Repro\n\n## Expected");
  });

  it("returns empty defaults when no property table is present", () => {
    const content = ["# Template Title", "", "## Notes", "", "Some body content."].join("\n");
    const result = parseTemplate(content);
    expect(result.defaults).toEqual({});
    // H1 is stripped since the entry creator builds its own heading.
    expect(result.body).toBe("## Notes\n\nSome body content.");
  });

  it("returns full body when no property table and no leading H1", () => {
    const content = "Just some plain body text.";
    const result = parseTemplate(content);
    expect(result.defaults).toEqual({});
    expect(result.body).toBe("Just some plain body text.");
  });

  it("body is empty when template is only a property table", () => {
    const content = ["| Property | Value |", "| -------- | ----- |", "| type     | bug   |"].join("\n");
    const result = parseTemplate(content);
    expect(result.defaults).toEqual({ type: "bug" });
    expect(result.body).toBe("");
  });
});
