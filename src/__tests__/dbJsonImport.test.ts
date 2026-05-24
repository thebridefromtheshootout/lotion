import { parseJsonToTabular, JsonImportError } from "../database/dbJsonImport";

describe("parseJsonToTabular", () => {
  it("parses an array of objects with consistent keys", () => {
    const json = JSON.stringify([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const result = parseJsonToTabular(json);
    expect(result.headers).toEqual(["name", "age"]);
    expect(result.rows).toEqual([
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });

  it("unions keys in first-seen order across rows", () => {
    const json = JSON.stringify([{ a: 1, b: 2 }, { b: 3, c: 4 }, { a: 5 }]);
    const result = parseJsonToTabular(json);
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([
      ["1", "2", ""],
      ["", "3", "4"],
      ["5", "", ""],
    ]);
  });

  it("stringifies booleans / numbers / null / nested objects", () => {
    const json = JSON.stringify([{ flag: true, count: 0, missing: null, nested: { x: 1 }, list: [1, 2] }]);
    const result = parseJsonToTabular(json);
    expect(result.rows[0]).toEqual(["true", "0", "", '{"x":1}', "[1,2]"]);
  });

  it("treats a primitive array as a single value column", () => {
    const json = JSON.stringify(["a", "b", "c"]);
    const result = parseJsonToTabular(json);
    expect(result.headers).toEqual(["value"]);
    expect(result.rows).toEqual([["a"], ["b"], ["c"]]);
  });

  it("returns empty headers/rows for an empty array", () => {
    const result = parseJsonToTabular("[]");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("throws for invalid JSON", () => {
    expect(() => parseJsonToTabular("{not json")).toThrow(JsonImportError);
  });

  it("throws when top-level is not an array", () => {
    expect(() => parseJsonToTabular('{"a": 1}')).toThrow("JSON must be an array of objects.");
  });

  it("throws when array mixes objects with non-objects", () => {
    const json = JSON.stringify([{ a: 1 }, "stringy"]);
    expect(() => parseJsonToTabular(json)).toThrow(/mixed arrays/i);
  });
});
