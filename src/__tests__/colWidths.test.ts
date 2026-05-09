import { clampWidth, loadColumnWidths, saveColumnWidths } from "../webview/utils/colWidths";

class MemoryStorage {
  store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
}

beforeEach(() => {
  (global as any).window = { localStorage: new MemoryStorage() };
});

describe("clampWidth", () => {
  it("rejects non-finite values by falling back to the minimum", () => {
    expect(clampWidth(NaN)).toBe(60);
    expect(clampWidth(Infinity)).toBe(60);
    expect(clampWidth(-Infinity)).toBe(60);
  });

  it("clamps below the minimum", () => {
    expect(clampWidth(10)).toBe(60);
    expect(clampWidth(0)).toBe(60);
    expect(clampWidth(-50)).toBe(60);
  });

  it("clamps above the maximum", () => {
    expect(clampWidth(5000)).toBe(1200);
  });

  it("rounds in-range values", () => {
    expect(clampWidth(123.6)).toBe(124);
  });
});

describe("loadColumnWidths / saveColumnWidths", () => {
  it("returns empty object when nothing stored", () => {
    expect(loadColumnWidths("alpha")).toEqual({});
  });

  it("round-trips a width map", () => {
    saveColumnWidths("alpha", { Status: 200, Notes: 300 });
    expect(loadColumnWidths("alpha")).toEqual({ Status: 200, Notes: 300 });
  });

  it("keeps databases isolated by name", () => {
    saveColumnWidths("alpha", { Status: 200 });
    saveColumnWidths("beta", { Status: 400 });
    expect(loadColumnWidths("alpha")).toEqual({ Status: 200 });
    expect(loadColumnWidths("beta")).toEqual({ Status: 400 });
  });

  it("clamps loaded values into the legal range", () => {
    (global as any).window.localStorage.setItem(
      "lotion.dbview.colWidths.alpha",
      JSON.stringify({ Notes: 9999, Status: 5 }),
    );
    expect(loadColumnWidths("alpha")).toEqual({ Notes: 1200, Status: 60 });
  });

  it("returns empty for malformed JSON", () => {
    (global as any).window.localStorage.setItem("lotion.dbview.colWidths.alpha", "{not json");
    expect(loadColumnWidths("alpha")).toEqual({});
  });

  it("ignores non-numeric stored values", () => {
    (global as any).window.localStorage.setItem(
      "lotion.dbview.colWidths.alpha",
      JSON.stringify({ Notes: "wide", Status: 150 }),
    );
    expect(loadColumnWidths("alpha")).toEqual({ Status: 150 });
  });

  it("returns empty when dbName is empty", () => {
    saveColumnWidths("alpha", { Status: 200 });
    expect(loadColumnWidths("")).toEqual({});
  });
});
