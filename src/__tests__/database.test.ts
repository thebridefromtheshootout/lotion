import {
  parseSchemaFromText,
  serializeSchema,
  parseViewsFromText,
  serializeViews,
  parsePropertyTable,
  buildPropertyTable,
  DbSchema,
  DbView,
} from "../database/database";

// ═══════════════════════════════════════════════════════════════════
// parseSchemaFromText
// ═══════════════════════════════════════════════════════════════════

describe("parseSchemaFromText", () => {
  it("returns undefined for text without lotion-db block", () => {
    expect(parseSchemaFromText("# Hello\nSome text")).toBeUndefined();
  });

  it("returns undefined for empty lotion-db block", () => {
    expect(parseSchemaFromText("```lotion-db\n```")).toBeUndefined();
  });

  it("parses a single text column", () => {
    const text = ["```lotion-db", "columns:", "  - name: Title", "    type: text", "```"].join("\n");

    const schema = parseSchemaFromText(text);
    expect(schema).toBeDefined();
    expect(schema!.columns).toHaveLength(1);
    expect(schema!.columns[0]).toEqual({ name: "Title", type: "text" });
  });

  it("parses multiple columns of various types", () => {
    const text = [
      "```lotion-db",
      "columns:",
      "  - name: Status",
      "    type: select",
      "    options: [Not Started, In Progress, Done]",
      "  - name: Due Date",
      "    type: date",
      "  - name: Priority",
      "    type: number",
      "```",
    ].join("\n");

    const schema = parseSchemaFromText(text);
    expect(schema).toBeDefined();
    expect(schema!.columns).toHaveLength(3);
    expect(schema!.columns[0]).toEqual({
      name: "Status",
      type: "select",
      options: ["Not Started", "In Progress", "Done"],
    });
    expect(schema!.columns[1]).toEqual({ name: "Due Date", type: "date" });
    expect(schema!.columns[2]).toEqual({ name: "Priority", type: "number" });
  });

  it("handles surrounding markdown content", () => {
    const text = [
      "# My Database",
      "",
      "Some intro text.",
      "",
      "```lotion-db",
      "columns:",
      "  - name: Name",
      "    type: text",
      "```",
      "",
      "More text below.",
    ].join("\n");

    const schema = parseSchemaFromText(text);
    expect(schema).toBeDefined();
    expect(schema!.columns).toHaveLength(1);
  });

  it("handles all column types", () => {
    const types = ["text", "number", "select", "multi-select", "date", "checkbox", "url"] as const;
    const lines = ["```lotion-db", "columns:"];
    for (const t of types) {
      lines.push(`  - name: Col_${t}`, `    type: ${t}`);
    }
    lines.push("```");

    const schema = parseSchemaFromText(lines.join("\n"));
    expect(schema).toBeDefined();
    expect(schema!.columns).toHaveLength(types.length);
    for (let i = 0; i < types.length; i++) {
      expect(schema!.columns[i].type).toBe(types[i]);
    }
  });

  it("handles CRLF line endings", () => {
    const text = "```lotion-db\r\ncolumns:\r\n  - name: A\r\n    type: text\r\n```";
    const schema = parseSchemaFromText(text);
    expect(schema).toBeDefined();
    expect(schema!.columns).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// serializeSchema
// ═══════════════════════════════════════════════════════════════════

describe("serializeSchema", () => {
  it("serializes a single column", () => {
    const schema: DbSchema = { columns: [{ name: "Title", type: "text" }] };
    const result = serializeSchema(schema);
    expect(result).toContain("columns:");
    expect(result).toContain("  - name: Title");
    expect(result).toContain("    type: text");
  });

  it("includes options for select columns", () => {
    const schema: DbSchema = {
      columns: [{ name: "Status", type: "select", options: ["Open", "Closed"] }],
    };
    const result = serializeSchema(schema);
    expect(result).toContain("options: [Open, Closed]");
  });

  it("omits options line when no options", () => {
    const schema: DbSchema = { columns: [{ name: "Name", type: "text" }] };
    const result = serializeSchema(schema);
    expect(result).not.toContain("options:");
  });

  it("round-trips: parse → serialize → parse yields equal schema", () => {
    const original: DbSchema = {
      columns: [
        { name: "Title", type: "text" },
        { name: "Status", type: "select", options: ["A", "B", "C"] },
        { name: "Count", type: "number" },
      ],
    };

    const serialized = serializeSchema(original);
    const parsed = parseSchemaFromText("```lotion-db\n" + serialized + "\n```");
    expect(parsed).toBeDefined();
    expect(parsed!.columns).toEqual(original.columns);
  });
});

// ═══════════════════════════════════════════════════════════════════
// parseViewsFromText
// ═══════════════════════════════════════════════════════════════════

describe("parseViewsFromText", () => {
  it("returns empty array for text without views block", () => {
    expect(parseViewsFromText("# Hello")).toEqual([]);
  });

  it("parses a single view with no filters", () => {
    const text = ["```lotion-db-views", "views:", "  - name: All", "```"].join("\n");

    const views = parseViewsFromText(text);
    expect(views).toHaveLength(1);
    expect(views[0].name).toBe("All");
    expect(views[0].filters).toEqual([]);
  });

  it("parses view with sort settings", () => {
    const text = [
      "```lotion-db-views",
      "views:",
      "  - name: By Date",
      "    sortCol: Due Date",
      "    sortDir: desc",
      "```",
    ].join("\n");

    const views = parseViewsFromText(text);
    expect(views[0].sortCol).toBe("Due Date");
    expect(views[0].sortDir).toBe("desc");
  });

  it("parses view with default flag", () => {
    const text = ["```lotion-db-views", "views:", "  - name: Default View", "    default: true", "```"].join("\n");

    const views = parseViewsFromText(text);
    expect(views[0].default).toBe(true);
  });

  it("parses filters with KQL operators", () => {
    const text = [
      "```lotion-db-views",
      "views:",
      "  - name: Filtered",
      "    filters:",
      "      - col: Status",
      "        op: ==",
      "        value: Done",
      "      - col: Priority",
      "        op: >=",
      "        value: 3",
      "```",
    ].join("\n");

    const views = parseViewsFromText(text);
    expect(views).toHaveLength(1);
    expect(views[0].filters).toHaveLength(2);
    expect(views[0].filters[0]).toEqual({ col: "Status", op: "==", value: "Done" });
    expect(views[0].filters[1]).toEqual({ col: "Priority", op: ">=", value: "3" });
  });

  it("defaults filter op to 'contains' when not specified", () => {
    const text = [
      "```lotion-db-views",
      "views:",
      "  - name: V",
      "    filters:",
      "      - col: Name",
      "        value: hello",
      "```",
    ].join("\n");

    const views = parseViewsFromText(text);
    expect(views[0].filters[0].op).toBe("contains");
  });

  it("parses multiple views", () => {
    const text = [
      "```lotion-db-views",
      "views:",
      "  - name: View A",
      "  - name: View B",
      "    default: true",
      "  - name: View C",
      "```",
    ].join("\n");

    const views = parseViewsFromText(text);
    expect(views).toHaveLength(3);
    expect(views.map((v) => v.name)).toEqual(["View A", "View B", "View C"]);
  });

  it("parses layout and kanbanGroupCol fields", () => {
    const text = [
      "```lotion-db-views",
      "views:",
      "  - name: Kanban Board",
      "    layout: kanban",
      "    kanbanGroupCol: Status",
      "    default: true",
      "```",
    ].join("\n");

    const views = parseViewsFromText(text);
    expect(views).toHaveLength(1);
    expect(views[0].layout).toBe("kanban");
    expect(views[0].kanbanGroupCol).toBe("Status");
    expect(views[0].default).toBe(true);
  });

  it("defaults layout to undefined when not specified", () => {
    const text = ["```lotion-db-views", "views:", "  - name: Plain", "```"].join("\n");

    const views = parseViewsFromText(text);
    expect(views[0].layout).toBeUndefined();
    expect(views[0].kanbanGroupCol).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// serializeViews
// ═══════════════════════════════════════════════════════════════════

describe("serializeViews", () => {
  it("serializes a simple view", () => {
    const views: DbView[] = [{ name: "All", filters: [] }];
    const result = serializeViews(views);
    expect(result).toContain("views:");
    expect(result).toContain("  - name: All");
  });

  it("includes sort settings", () => {
    const views: DbView[] = [
      {
        name: "Sorted",
        sortCol: "Date",
        sortDir: "desc",
        filters: [],
      },
    ];
    const result = serializeViews(views);
    expect(result).toContain("sortCol: Date");
    expect(result).toContain("sortDir: desc");
  });

  it("includes filter operators", () => {
    const views: DbView[] = [
      {
        name: "Filtered",
        filters: [{ col: "Status", op: "==", value: "Done" }],
      },
    ];
    const result = serializeViews(views);
    expect(result).toContain("op: ==");
    expect(result).toContain("value: Done");
  });

  it("round-trips views through parse/serialize", () => {
    const original: DbView[] = [
      {
        name: "Main",
        default: true,
        sortCol: "Created",
        sortDir: "asc",
        filters: [
          { col: "Status", op: "!=", value: "Archived" },
          { col: "Priority", op: ">=", value: "2" },
        ],
      },
      { name: "Secondary", filters: [] },
    ];

    const serialized = serializeViews(original);
    const parsed = parseViewsFromText("```lotion-db-views\n" + serialized + "\n```");

    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("Main");
    expect(parsed[0].default).toBe(true);
    expect(parsed[0].sortCol).toBe("Created");
    expect(parsed[0].sortDir).toBe("asc");
    expect(parsed[0].filters).toHaveLength(2);
    expect(parsed[0].filters[0].op).toBe("!=");
    expect(parsed[1].name).toBe("Secondary");
  });

  it("serializes layout and kanbanGroupCol", () => {
    const views: DbView[] = [
      {
        name: "Board",
        layout: "kanban",
        kanbanGroupCol: "Priority",
        filters: [],
      },
    ];
    const result = serializeViews(views);
    expect(result).toContain("layout: kanban");
    expect(result).toContain("kanbanGroupCol: Priority");
  });

  it("omits layout when table (default)", () => {
    const views: DbView[] = [
      {
        name: "Default",
        layout: "table",
        filters: [],
      },
    ];
    const result = serializeViews(views);
    expect(result).not.toContain("layout:");
  });

  it("round-trips kanban views through parse/serialize", () => {
    const original: DbView[] = [
      {
        name: "Kanban View",
        default: true,
        layout: "kanban",
        kanbanGroupCol: "Status",
        sortCol: "Title",
        sortDir: "asc",
        filters: [{ col: "Tag", op: "contains", value: "work" }],
      },
    ];

    const serialized = serializeViews(original);
    const parsed = parseViewsFromText("```lotion-db-views\n" + serialized + "\n```");

    expect(parsed).toHaveLength(1);
    expect(parsed[0].layout).toBe("kanban");
    expect(parsed[0].kanbanGroupCol).toBe("Status");
    expect(parsed[0].sortCol).toBe("Title");
    expect(parsed[0].filters).toHaveLength(1);
  });

  it("serializes calendar view fields", () => {
    const views: DbView[] = [
      {
        name: "Timeline",
        layout: "calendar",
        calendarDateCol: "Start Date",
        calendarEndDateCol: "End Date",
        filters: [],
      },
    ];
    const result = serializeViews(views);
    expect(result).toContain("layout: calendar");
    expect(result).toContain("calendarDateCol: Start Date");
    expect(result).toContain("calendarEndDateCol: End Date");
  });

  it("round-trips calendar views through parse/serialize", () => {
    const original: DbView[] = [
      {
        name: "Calendar View",
        default: true,
        layout: "calendar",
        calendarDateCol: "Due",
        calendarEndDateCol: "Completed",
        sortCol: "Priority",
        sortDir: "desc",
        filters: [],
      },
    ];

    const serialized = serializeViews(original);
    const parsed = parseViewsFromText("```lotion-db-views\n" + serialized + "\n```");

    expect(parsed).toHaveLength(1);
    expect(parsed[0].layout).toBe("calendar");
    expect(parsed[0].calendarDateCol).toBe("Due");
    expect(parsed[0].calendarEndDateCol).toBe("Completed");
    expect(parsed[0].sortCol).toBe("Priority");
    expect(parsed[0].sortDir).toBe("desc");
  });

  it("omits calendarEndDateCol when not set", () => {
    const views: DbView[] = [
      {
        name: "Point Events",
        layout: "calendar",
        calendarDateCol: "Date",
        filters: [],
      },
    ];
    const result = serializeViews(views);
    expect(result).toContain("calendarDateCol: Date");
    expect(result).not.toContain("calendarEndDateCol");
  });
});

// ═══════════════════════════════════════════════════════════════════
// parsePropertyTable
// ═══════════════════════════════════════════════════════════════════

describe("parsePropertyTable", () => {
  it("returns undefined when no property table present", () => {
    expect(parsePropertyTable("# No table here")).toBeUndefined();
  });

  it("returns undefined when header has no separator row", () => {
    const text = "| Property | Value |\n| Status | done |";
    expect(parsePropertyTable(text)).toBeUndefined();
  });

  it("parses simple key-value pairs", () => {
    const text = "# Entry\n\n| Property | Value |\n| -------- | ----- |\n| title    | My Page |\n| status   | Draft   |\n";
    const result = parsePropertyTable(text);
    expect(result).toEqual({ title: "My Page", status: "Draft" });
  });

  it("handles empty values", () => {
    const text = "| Property | Value |\n| -------- | ----- |\n| title    |       |\n| author   |       |\n";
    const result = parsePropertyTable(text);
    expect(result).toEqual({ title: "", author: "" });
  });

  it("handles values with colons", () => {
    const text = "| Property | Value               |\n| -------- | ------------------- |\n| url      | https://example.com |\n";
    const result = parsePropertyTable(text);
    expect(result).toBeDefined();
    expect(result!.url).toBe("https://example.com");
  });

  it("trims whitespace from keys and values", () => {
    const text = "| Property | Value   |\n| -------- | ------- |\n|  title   |  Spaced |\n";
    const result = parsePropertyTable(text);
    expect(result).toBeDefined();
    expect(result!.title).toBe("Spaced");
  });

  it("unescapes pipe characters in values", () => {
    const text = "| Property | Value         |\n| -------- | ------------- |\n| formula  | a \\| b \\| c  |\n";
    const result = parsePropertyTable(text);
    expect(result).toBeDefined();
    expect(result!.formula).toBe("a | b | c");
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildPropertyTable
// ═══════════════════════════════════════════════════════════════════

describe("buildPropertyTable", () => {
  it("builds an aligned 2-column table", () => {
    const result = buildPropertyTable({ Status: "done", Priority: "0", "Due Date": "2026-02-27" });
    const lines = result.split("\n");
    expect(lines[0]).toMatch(/^\| Property\s+\| Value\s+\|$/);
    expect(lines[1]).toMatch(/^\| -+ \| -+ \|$/);
    expect(lines.length).toBe(5); // header + separator + 3 rows
    // All rows should be same length (aligned)
    const lengths = lines.map((l) => l.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("escapes pipe characters in values", () => {
    const result = buildPropertyTable({ formula: "a | b" });
    expect(result).toContain("a \\| b");
  });

  it("pads columns to at least header width", () => {
    const result = buildPropertyTable({ x: "y" });
    // "Property" = 8 chars, "Value" = 5 chars — both should be padded
    const lines = result.split("\n");
    expect(lines[0]).toBe("| Property | Value |");
    expect(lines[1]).toBe("| -------- | ----- |");
    expect(lines[2]).toBe("| x        | y     |");
  });
});
