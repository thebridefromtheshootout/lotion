import { guid, shortId } from "../core/ids";

describe("guid", () => {
  it("returns a 36-char RFC 4122 v4 string", () => {
    const v = guid();
    expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("returns distinct values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(guid());
    expect(seen.size).toBe(100);
  });
});

describe("shortId", () => {
  it("returns 14 alphanumeric chars", () => {
    const s = shortId();
    expect(s).toMatch(/^[a-z0-9]{14}$/);
  });

  it("returns distinct values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(shortId());
    expect(seen.size).toBe(100);
  });
});
