import { entriesToMarkdownTable, DB_TABLE_MARKER_PREFIX } from "../webview/utils/markdownTableExport";
import type { DbColumn, DbEntryData } from "../webview/types";

const schema: DbColumn[] = [
  { name: "Status", type: "select", options: ["todo", "done"] },
  { name: "Priority", type: "number" },
];

describe("entriesToMarkdownTable", () => {
  it("prefixes the table with a DB-origin marker quoting the workspace path", () => {
    const out = entriesToMarkdownTable([], schema, "Title", "projects/index.md");
    expect(out.startsWith(`${DB_TABLE_MARKER_PREFIX}"projects/index.md" -->`)).toBe(true);
  });

  it("emits header + separator + data rows", () => {
    const entries: DbEntryData[] = [
      { title: "Alpha", relativePath: "alpha/index.md", properties: { Status: "todo", Priority: "3" } },
      { title: "Beta", relativePath: "beta/index.md", properties: { Status: "done", Priority: "1" } },
    ];
    const out = entriesToMarkdownTable(entries, schema, "Name", "tasks/index.md");
    const lines = out.split("\n");
    expect(lines[1]).toMatch(/\|\s*Name\s*\|\s*Status\s*\|\s*Priority\s*\|/);
    expect(lines[2]).toMatch(/\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|/);
    expect(lines[3]).toMatch(/\|\s*Alpha\s*\|\s*todo\s*\|\s*3\s*\|/);
    expect(lines[4]).toMatch(/\|\s*Beta\s*\|\s*done\s*\|\s*1\s*\|/);
  });

  it("escapes pipes and collapses newlines in cells", () => {
    const entries: DbEntryData[] = [
      { title: "Has | Pipe", relativePath: "x/index.md", properties: { Status: "a\nb", Priority: "1" } },
    ];
    const out = entriesToMarkdownTable(entries, schema, "Name", "db/index.md");
    expect(out).toContain("Has \\| Pipe");
    expect(out).toContain("a b");
    expect(out).not.toContain("a\nb");
  });

  it("pads columns to the longest cell width", () => {
    const entries: DbEntryData[] = [
      { title: "Short", relativePath: "s/index.md", properties: { Status: "x", Priority: "1" } },
      { title: "MuchLongerTitle", relativePath: "l/index.md", properties: { Status: "todo", Priority: "10" } },
    ];
    const out = entriesToMarkdownTable(entries, schema, "Name", "db/index.md");
    const lines = out.split("\n");
    // Header + separator + 2 data rows must all be the same length.
    expect(new Set([lines[1].length, lines[2].length, lines[3].length, lines[4].length]).size).toBe(1);
  });
});
