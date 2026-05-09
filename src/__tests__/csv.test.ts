import { entriesToCsv, escapeCsvCell } from "../webview/utils/csv";
import type { DbColumn, DbEntryData } from "../webview/types";

describe("escapeCsvCell", () => {
  it("returns empty string unchanged", () => {
    expect(escapeCsvCell("")).toBe("");
  });

  it("returns plain values unchanged", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
  });

  it("quotes values with commas", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("quotes values with double quotes and doubles internal quotes", () => {
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quotes values with newlines", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });
});

describe("entriesToCsv", () => {
  const schema: DbColumn[] = [
    { name: "Status", type: "select" },
    { name: "Notes", type: "text" },
  ];

  it("produces a header row from titleFieldLabel + schema columns", () => {
    const csv = entriesToCsv([], schema, "Title");
    expect(csv).toBe("Title,Status,Notes");
  });

  it("emits one CRLF-separated row per entry", () => {
    const entries: DbEntryData[] = [
      { title: "Alice", relativePath: "alice/index.md", properties: { Status: "Active", Notes: "First" } },
      { title: "Bob", relativePath: "bob/index.md", properties: { Status: "Pending", Notes: "Second" } },
    ];
    const csv = entriesToCsv(entries, schema, "Name");
    expect(csv).toBe("Name,Status,Notes\r\nAlice,Active,First\r\nBob,Pending,Second");
  });

  it("emits empty cells for missing properties", () => {
    const entries: DbEntryData[] = [
      { title: "Carol", relativePath: "carol/index.md", properties: { Status: "Done" } },
    ];
    const csv = entriesToCsv(entries, schema, "Name");
    expect(csv).toBe("Name,Status,Notes\r\nCarol,Done,");
  });

  it("escapes embedded commas, quotes, and newlines correctly", () => {
    const entries: DbEntryData[] = [
      {
        title: 'Has, "stuff"',
        relativePath: "x/index.md",
        properties: { Status: "ok", Notes: "line1\nline2" },
      },
    ];
    const csv = entriesToCsv(entries, schema, "Name");
    expect(csv).toBe('Name,Status,Notes\r\n"Has, ""stuff""",ok,"line1\nline2"');
  });

  it("preserves schema column order even when properties dict is unordered", () => {
    const reversedSchema: DbColumn[] = [
      { name: "Notes", type: "text" },
      { name: "Status", type: "select" },
    ];
    const entries: DbEntryData[] = [
      { title: "Dan", relativePath: "dan/index.md", properties: { Status: "S", Notes: "N" } },
    ];
    const csv = entriesToCsv(entries, reversedSchema, "Name");
    expect(csv).toBe("Name,Notes,Status\r\nDan,N,S");
  });
});
