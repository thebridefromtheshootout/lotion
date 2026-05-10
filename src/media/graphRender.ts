import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

// ── Lazy-loaded viz.js instance ────────────────────────────────────

let vizInstance: any | undefined;

async function getViz(): Promise<any> {
  if (vizInstance) {
    return vizInstance;
  }
  const Viz: any = require("@viz-js/viz");
  vizInstance = await Viz.instance();
  return vizInstance;
}

export async function renderDot(dot: string): Promise<string> {
  const viz = await getViz();
  return viz.renderString(dot, { format: "svg" }) as string;
}

// ── SVG file output ────────────────────────────────────────────────

/** Generate a short hash from DOT source for unique filenames. */
function dotHash(dot: string): string {
  return crypto.createHash("sha256").update(dot).digest("hex").slice(0, 8);
}

/** Write SVG to .rsrc/ and return the relative path for markdown. */
export function writeSvgFile(cwd: string, svg: string, dot: string): string {
  const rsrcDir = path.join(cwd, ".rsrc");
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
  }
  const filename = `graph-${dotHash(dot)}.svg`;
  const absPath = path.join(rsrcDir, filename);
  fs.writeFileSync(absPath, svg, "utf-8");
  return `.rsrc/${filename}`;
}
