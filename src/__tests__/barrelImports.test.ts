import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");
const FEATURE_DIRS = [
  "editor",
  "blocks",
  "links",
  "media",
  "navigation",
  "productivity",
  "lists",
  "formatting",
  "views",
  "database",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__" || entry.name === "test") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) out.push(full);
  }
  return out;
}

describe("barrel import discipline", () => {
  // Importing a parent's index barrel (e.g. `../../core`) from a leaf module
  // creates a load-order cycle: while the barrel is mid-evaluation, exports
  // are `undefined`, which silently corrupts arrays like SLASH_COMMANDS or
  // CODELENS_GENERATORS. Force leaves to import the concrete submodule
  // (e.g. `../../core/commands`) instead.
  test("no feature module imports the core barrel", () => {
    const offenders: string[] = [];
    for (const dir of FEATURE_DIRS) {
      const root = path.join(SRC, dir);
      if (!fs.existsSync(root)) continue;
      for (const file of walk(root)) {
        const text = fs.readFileSync(file, "utf8");
        if (/from\s+["'](?:\.\.\/)+core(?:\/index)?["']/.test(text)) {
          offenders.push(path.relative(SRC, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no leaf module imports its own feature barrel", () => {
    const offenders: string[] = [];
    for (const dir of FEATURE_DIRS) {
      const root = path.join(SRC, dir);
      if (!fs.existsSync(root)) continue;
      const ownBarrelPattern = new RegExp(`from\\s+["'](?:\\.\\./)+${dir}(?:/index)?["']`);
      for (const file of walk(root)) {
        const text = fs.readFileSync(file, "utf8");
        if (ownBarrelPattern.test(text)) {
          offenders.push(path.relative(SRC, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
