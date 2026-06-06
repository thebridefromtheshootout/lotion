import { validateColumnValue, validateUniqueness, validateEntry } from "../database/dbValidate";
import type { DbColumn, DbSchema } from "../contracts/databaseTypes";

// ═══════════════════════════════════════════════════════════════════
// validateColumnValue — per-value, per-column checks
// ═══════════════════════════════════════════════════════════════════

describe("validateColumnValue", () => {
  describe("required", () => {
    it("rejects empty value on a required column", () => {
      const col: DbColumn = { name: "Name", type: "text", required: true };
      expect(validateColumnValue(col, "")).toBe("Name is required");
      expect(validateColumnValue(col, "   ")).toBe("Name is required");
      expect(validateColumnValue(col, undefined)).toBe("Name is required");
    });

    it("accepts empty value on an optional column", () => {
      const col: DbColumn = { name: "Note", type: "text" };
      expect(validateColumnValue(col, "")).toBeUndefined();
      expect(validateColumnValue(col, undefined)).toBeUndefined();
    });

    it("accepts a non-empty value on a required column", () => {
      const col: DbColumn = { name: "Name", type: "text", required: true };
      expect(validateColumnValue(col, "Acme")).toBeUndefined();
    });
  });

  describe("number type + min/max", () => {
    it("rejects non-numeric input", () => {
      const col: DbColumn = { name: "Count", type: "number" };
      expect(validateColumnValue(col, "abc")).toBe("Count must be a number");
    });

    it("rejects values below min", () => {
      const col: DbColumn = { name: "Priority", type: "number", min: 1, max: 5 };
      expect(validateColumnValue(col, "0")).toBe("Priority must be ≥ 1");
    });

    it("rejects values above max", () => {
      const col: DbColumn = { name: "Priority", type: "number", min: 1, max: 5 };
      expect(validateColumnValue(col, "6")).toBe("Priority must be ≤ 5");
    });

    it("accepts boundary values (inclusive)", () => {
      const col: DbColumn = { name: "Priority", type: "number", min: 1, max: 5 };
      expect(validateColumnValue(col, "1")).toBeUndefined();
      expect(validateColumnValue(col, "5")).toBeUndefined();
    });

    it("accepts floats", () => {
      const col: DbColumn = { name: "Score", type: "number", min: 0, max: 1 };
      expect(validateColumnValue(col, "0.42")).toBeUndefined();
    });
  });

  describe("date type", () => {
    it("rejects non-ISO dates", () => {
      const col: DbColumn = { name: "Due", type: "date" };
      expect(validateColumnValue(col, "tomorrow")).toBe("Due must be YYYY-MM-DD");
      expect(validateColumnValue(col, "2026/05/24")).toBe("Due must be YYYY-MM-DD");
    });

    it("accepts ISO YYYY-MM-DD", () => {
      const col: DbColumn = { name: "Due", type: "date" };
      expect(validateColumnValue(col, "2026-05-24")).toBeUndefined();
    });
  });

  describe("checkbox type", () => {
    it("only accepts true / false", () => {
      const col: DbColumn = { name: "Done", type: "checkbox" };
      expect(validateColumnValue(col, "true")).toBeUndefined();
      expect(validateColumnValue(col, "false")).toBeUndefined();
      expect(validateColumnValue(col, "yes")).toBe("Done must be true or false");
    });
  });

  describe("select type with options", () => {
    const col: DbColumn = { name: "Status", type: "select", options: ["todo", "doing", "done"] };

    it("rejects values not in options", () => {
      expect(validateColumnValue(col, "blocked")).toBe("Status must be one of: todo, doing, done");
    });

    it("accepts values in options", () => {
      expect(validateColumnValue(col, "doing")).toBeUndefined();
    });

    it("skips option check when options not defined", () => {
      const open: DbColumn = { name: "Tag", type: "select" };
      expect(validateColumnValue(open, "anything")).toBeUndefined();
    });
  });

  describe("multi-select type with options", () => {
    const col: DbColumn = { name: "Tags", type: "multi-select", options: ["red", "green", "blue"] };

    it("accepts subset of options", () => {
      expect(validateColumnValue(col, "red, blue")).toBeUndefined();
    });

    it("rejects any unknown option", () => {
      expect(validateColumnValue(col, "red, purple")).toBe("Tags contains unknown option(s): purple");
    });
  });

  describe("coordinates type", () => {
    const col: DbColumn = { name: "Place", type: "coordinates" };

    it("accepts lat, lng", () => {
      expect(validateColumnValue(col, "48.8566, 2.3522")).toBeUndefined();
    });

    it("rejects malformed coordinates", () => {
      expect(validateColumnValue(col, "Paris")).toBe("Place must be lat, lng");
      expect(validateColumnValue(col, "48.8566")).toBe("Place must be lat, lng");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// validateUniqueness
// ═══════════════════════════════════════════════════════════════════

describe("validateUniqueness", () => {
  const col: DbColumn = { name: "Slug", type: "text", unique: true };

  it("ignores non-unique columns", () => {
    const plain: DbColumn = { name: "Note", type: "text" };
    expect(validateUniqueness(plain, "x", ["x", "x"])).toBeUndefined();
  });

  it("rejects exact collisions", () => {
    expect(validateUniqueness(col, "alpha", ["beta", "alpha"])).toBe("Slug must be unique (value already exists)");
  });

  it("treats comparison as case-insensitive + trimmed", () => {
    expect(validateUniqueness(col, "Alpha", ["  alpha  "])).toBe("Slug must be unique (value already exists)");
  });

  it("allows empty value (defer to required check)", () => {
    expect(validateUniqueness(col, "", ["alpha"])).toBeUndefined();
  });

  it("allows novel values", () => {
    expect(validateUniqueness(col, "gamma", ["alpha", "beta"])).toBeUndefined();
  });

  describe("multi-select", () => {
    const ms: DbColumn = { name: "Tags", type: "multi-select", options: ["red", "green", "blue"], unique: true };

    it("treats values with the same items in different order as duplicates", () => {
      expect(validateUniqueness(ms, "red, blue", ["green", "blue, red"])).toBe(
        "Tags must be unique (value already exists)",
      );
    });

    it("treats whitespace + case variation as duplicates", () => {
      expect(validateUniqueness(ms, "Red,  Blue", ["blue,red"])).toBe("Tags must be unique (value already exists)");
    });

    it("does not flag a true set difference", () => {
      expect(validateUniqueness(ms, "red, blue", ["red, green"])).toBeUndefined();
    });

    it("collapses intra-cell duplicates before comparing", () => {
      // "red, red, blue" → set {red, blue}; should match "blue, red".
      expect(validateUniqueness(ms, "red, red, blue", ["blue, red"])).toBe(
        "Tags must be unique (value already exists)",
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// validateEntry — full schema sweep
// ═══════════════════════════════════════════════════════════════════

describe("validateEntry", () => {
  const schema: DbSchema = {
    columns: [
      { name: "Slug", type: "text", required: true, unique: true },
      { name: "Status", type: "select", options: ["todo", "doing", "done"], required: true },
      { name: "Priority", type: "number", min: 1, max: 5 },
    ],
  };

  it("returns no violations for a valid entry", () => {
    const result = validateEntry(schema, { Slug: "alpha", Status: "todo", Priority: "3" }, []);
    expect(result).toEqual([]);
  });

  it("collects per-column violations", () => {
    const result = validateEntry(schema, { Slug: "", Status: "blocked", Priority: "99" }, []);
    expect(result).toEqual([
      { col: "Slug", message: "Slug is required" },
      { col: "Status", message: "Status must be one of: todo, doing, done" },
      { col: "Priority", message: "Priority must be ≤ 5" },
    ]);
  });

  it("only checks uniqueness when value passes per-cell validation", () => {
    const result = validateEntry(schema, { Slug: "", Status: "todo" }, [{ Slug: "", Status: "todo" }]);
    expect(result.find((v) => v.col === "Slug")?.message).toBe("Slug is required");
  });

  it("flags uniqueness collisions against other entries", () => {
    const result = validateEntry(schema, { Slug: "alpha", Status: "todo" }, [{ Slug: "alpha", Status: "done" }]);
    expect(result).toEqual([{ col: "Slug", message: "Slug must be unique (value already exists)" }]);
  });
});
