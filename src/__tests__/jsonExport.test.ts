import { entriesToJson } from "../webview/utils/jsonExport";
import type { DbColumn, DbEntryData } from "../webview/types";

const schema: DbColumn[] = [
  { name: "Status", type: "select", options: ["todo", "done"] },
  { name: "Priority", type: "number" },
];

describe("entriesToJson", () => {
  it("returns an empty array for no entries", () => {
    expect(entriesToJson([], schema, "Title")).toBe("[]");
  });

  it("serializes entries with title field + schema columns", () => {
    const entries: DbEntryData[] = [
      { title: "Alpha", relativePath: "alpha/index.md", properties: { Status: "todo", Priority: "3" } },
      { title: "Beta", relativePath: "beta/index.md", properties: { Status: "done", Priority: "1" } },
    ];
    const json = entriesToJson(entries, schema, "Name");
    expect(JSON.parse(json)).toEqual([
      { Name: "Alpha", Status: "todo", Priority: "3" },
      { Name: "Beta", Status: "done", Priority: "1" },
    ]);
  });

  it("fills missing properties with empty strings", () => {
    const entries: DbEntryData[] = [
      { title: "Only Status", relativePath: "x/index.md", properties: { Status: "todo" } },
    ];
    expect(JSON.parse(entriesToJson(entries, schema, "Name"))).toEqual([
      { Name: "Only Status", Status: "todo", Priority: "" },
    ]);
  });
});
