import { matchesEnabledCase } from "../formatting/autoInlineCode";

describe("matchesEnabledCase", () => {
  it("returns false when no setting is enabled", () => {
    expect(matchesEnabledCase("FooBar", {})).toBe(false);
    expect(matchesEnabledCase("FooBar", { PascalCase: false, camelCase: false, snake_case: false })).toBe(false);
  });

  describe("PascalCase", () => {
    const cases = { PascalCase: true } as const;
    it("matches multi-segment PascalCase", () => {
      expect(matchesEnabledCase("FooBar", cases)).toBe(true);
      expect(matchesEnabledCase("MyHTTPServer2", cases)).toBe(true);
      expect(matchesEnabledCase("ABC", cases)).toBe(false); // single segment of all caps doesn't qualify
    });

    it("rejects camelCase / snake_case", () => {
      expect(matchesEnabledCase("fooBar", cases)).toBe(false);
      expect(matchesEnabledCase("foo_bar", cases)).toBe(false);
    });

    it("rejects single-segment Pascal", () => {
      expect(matchesEnabledCase("Foo", cases)).toBe(false); // needs at least one capitalized boundary
    });
  });

  describe("camelCase", () => {
    const cases = { camelCase: true } as const;
    it("matches multi-segment camelCase", () => {
      expect(matchesEnabledCase("fooBar", cases)).toBe(true);
      expect(matchesEnabledCase("getUserById", cases)).toBe(true);
    });

    it("rejects PascalCase / snake_case / single-word", () => {
      expect(matchesEnabledCase("FooBar", cases)).toBe(false);
      expect(matchesEnabledCase("foo_bar", cases)).toBe(false);
      expect(matchesEnabledCase("foo", cases)).toBe(false);
    });
  });

  describe("snake_case", () => {
    const cases = { snake_case: true } as const;
    it("matches multi-segment snake_case", () => {
      expect(matchesEnabledCase("foo_bar", cases)).toBe(true);
      expect(matchesEnabledCase("get_user_by_id", cases)).toBe(true);
    });

    it("rejects PascalCase / camelCase / single-word", () => {
      expect(matchesEnabledCase("FooBar", cases)).toBe(false);
      expect(matchesEnabledCase("fooBar", cases)).toBe(false);
      expect(matchesEnabledCase("foo", cases)).toBe(false);
    });
  });

  it("ANDs settings — only enabled detectors apply", () => {
    expect(matchesEnabledCase("FooBar", { PascalCase: true, camelCase: false })).toBe(true);
    expect(matchesEnabledCase("fooBar", { PascalCase: true, camelCase: false })).toBe(false);
  });

  it("multiple settings enabled — any matches", () => {
    const both = { PascalCase: true, camelCase: true } as const;
    expect(matchesEnabledCase("FooBar", both)).toBe(true);
    expect(matchesEnabledCase("fooBar", both)).toBe(true);
    expect(matchesEnabledCase("foo_bar", both)).toBe(false);
  });
});
