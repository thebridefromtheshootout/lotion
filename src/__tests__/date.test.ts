import { formatDate, pad } from "../editor/date";

// ═══════════════════════════════════════════════════════════════════
// pad
// ═══════════════════════════════════════════════════════════════════

describe("pad", () => {
  it("pads single-digit numbers with zero", () => {
    expect(pad(0)).toBe("00");
    expect(pad(1)).toBe("01");
    expect(pad(9)).toBe("09");
  });

  it("does not pad double-digit numbers", () => {
    expect(pad(10)).toBe("10");
    expect(pad(31)).toBe("31");
    expect(pad(99)).toBe("99");
  });
});

// ═══════════════════════════════════════════════════════════════════
// formatDate
// ═══════════════════════════════════════════════════════════════════

describe("formatDate", () => {
  // Use a fixed date: Wednesday, July 23, 2025, 14:05
  const date = new Date(2025, 6, 23, 14, 5);

  it("formats YYYY-MM-DD", () => {
    expect(formatDate(date, "YYYY-MM-DD")).toBe("2025-07-23");
  });

  it("formats MM/DD/YYYY", () => {
    expect(formatDate(date, "MM/DD/YYYY")).toBe("07/23/2025");
  });

  it("formats DD/MM/YYYY", () => {
    expect(formatDate(date, "DD/MM/YYYY")).toBe("23/07/2025");
  });

  it("formats MMMM D, YYYY", () => {
    expect(formatDate(date, "MMMM D, YYYY")).toBe("July 23, 2025");
  });

  it("formats ddd, MMMM D, YYYY", () => {
    expect(formatDate(date, "ddd, MMMM D, YYYY")).toBe("Wed, July 23, 2025");
  });

  it("formats YYYY-MM-DD HH:mm", () => {
    expect(formatDate(date, "YYYY-MM-DD HH:mm")).toBe("2025-07-23 14:05");
  });

  it("pads month and day correctly", () => {
    const jan1 = new Date(2025, 0, 1);
    expect(formatDate(jan1, "YYYY-MM-DD")).toBe("2025-01-01");
  });

  it("handles day names correctly", () => {
    // Sunday
    const sun = new Date(2025, 6, 20);
    expect(formatDate(sun, "ddd")).toBe("Sun");
  });
});
