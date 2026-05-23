import { defaultOperatorFor, validOperatorsFor } from "../contracts/databaseTypes";

describe("validOperatorsFor", () => {
  test("text columns get string ops + in/!in + empty checks, no numeric/multi ops", () => {
    const ops = validOperatorsFor("text");
    expect(ops).toContain("contains");
    expect(ops).toContain("matches_regex");
    expect(ops).toContain("isempty");
    expect(ops).toContain("in");
    expect(ops).not.toContain("between");
    expect(ops).not.toContain(">");
    expect(ops).not.toContain("has_any");
  });

  test("number columns get numeric ops, no string ops", () => {
    const ops = validOperatorsFor("number");
    expect(ops).toContain(">");
    expect(ops).toContain("between");
    expect(ops).not.toContain("contains");
    expect(ops).not.toContain("matches_regex");
    expect(ops).not.toContain("has_any");
  });

  test("date columns get numeric ops + between, no contains/regex/has_any", () => {
    const ops = validOperatorsFor("date");
    expect(ops).toContain(">=");
    expect(ops).toContain("between");
    expect(ops).not.toContain("contains");
    expect(ops).not.toContain("matches_regex");
    expect(ops).not.toContain("in"); // dates as exact strings don't usually take a list
  });

  test("checkbox columns only get == / !=", () => {
    const ops = validOperatorsFor("checkbox");
    expect(ops).toEqual(["==", "!="]);
  });

  test("select columns get equality + in/!in + empty checks", () => {
    const ops = validOperatorsFor("select");
    expect(ops).toContain("==");
    expect(ops).toContain("in");
    expect(ops).not.toContain("has_any");
    expect(ops).not.toContain("contains");
  });

  test("multi-select columns get has_any / has_all + in/!in + contains", () => {
    const ops = validOperatorsFor("multi-select");
    expect(ops).toContain("has_any");
    expect(ops).toContain("has_all");
    expect(ops).toContain("contains");
    expect(ops).not.toContain(">");
    expect(ops).not.toContain("matches_regex");
  });

  test("url columns get string-shape ops but not in/!in/contains-list semantics", () => {
    const ops = validOperatorsFor("url");
    expect(ops).toContain("startswith");
    expect(ops).toContain("matches_regex");
    expect(ops).not.toContain("in");
    expect(ops).not.toContain("between");
  });

  test("image / coordinates: only empty checks until richer ops exist", () => {
    expect(validOperatorsFor("image")).toEqual(["isempty", "isnotempty"]);
    expect(validOperatorsFor("coordinates")).toEqual(["isempty", "isnotempty"]);
  });

  test("undefined type falls back to text ops", () => {
    expect(validOperatorsFor(undefined)).toEqual(validOperatorsFor("text"));
  });
});

describe("defaultOperatorFor", () => {
  test("returns an op that's in the type's valid set", () => {
    const types = [
      "text",
      "number",
      "date",
      "checkbox",
      "select",
      "multi-select",
      "url",
      "image",
      "coordinates",
    ] as const;
    for (const type of types) {
      const def = defaultOperatorFor(type);
      expect(validOperatorsFor(type)).toContain(def);
    }
  });

  test("text → contains; number/date → ==; multi-select → has_any", () => {
    expect(defaultOperatorFor("text")).toBe("contains");
    expect(defaultOperatorFor("number")).toBe("==");
    expect(defaultOperatorFor("date")).toBe("==");
    expect(defaultOperatorFor("multi-select")).toBe("has_any");
  });
});
