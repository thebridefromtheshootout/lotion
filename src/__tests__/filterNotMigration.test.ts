import { parseViewsFromText, serializeViews } from "../database/dbViews";
import type { DbView } from "../contracts/databaseTypes";

describe("filter NOT migration + persistence", () => {
  // Wraps view YAML in the same fence parseViewsFromText expects.
  function fence(yaml: string): string {
    return "```lotion-db-views\n" + yaml + "\n```";
  }

  test("legacy !contains op migrates to contains + not on parse", () => {
    const views = parseViewsFromText(
      fence(
        [
          "views:",
          "  - name: Active",
          "    filters:",
          "      - col: status",
          "        op: !contains",
          "        value: done",
        ].join("\n"),
      ),
    );
    expect(views[0].filters[0]).toEqual({ col: "status", op: "contains", value: "done", not: true });
  });

  test("explicit not: true persists round-trip without legacy op", () => {
    const original: DbView[] = [
      {
        name: "Active",
        filters: [{ col: "status", op: "contains", value: "done", not: true }],
      } as DbView,
    ];
    const serialized = serializeViews(original);
    expect(serialized).toContain("not: true");
    expect(serialized).not.toContain("!contains");

    const reparsed = parseViewsFromText(fence(serialized));
    expect(reparsed[0].filters[0]).toEqual({ col: "status", op: "contains", value: "done", not: true });
  });

  test("legacy !X op + explicit not: true cancel out (XOR)", () => {
    // `!=` migrates to `== + not`, then the `not: true` line flips back.
    // Net: { op: "==", not: false }.
    const views = parseViewsFromText(
      fence(
        [
          "views:",
          "  - name: Eq",
          "    filters:",
          "      - col: status",
          "        op: !=",
          "        value: done",
          "        not: true",
        ].join("\n"),
      ),
    );
    expect(views[0].filters[0]).toEqual({ col: "status", op: "==", value: "done", not: false });
  });

  test("affirmative op without not stays unchanged", () => {
    const views = parseViewsFromText(
      fence(
        [
          "views:",
          "  - name: Plain",
          "    filters:",
          "      - col: status",
          "        op: contains",
          "        value: done",
        ].join("\n"),
      ),
    );
    expect(views[0].filters[0]).toEqual({ col: "status", op: "contains", value: "done" });
    expect(views[0].filters[0].not).toBeUndefined();
  });
});
