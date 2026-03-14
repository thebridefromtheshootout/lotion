
import { CodeLens, Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { getCwd } from "../core/cwd";
import { Cmd } from "../core/commands";
import { createCodeLensProvider, codeLens } from "../core/codeLens";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";

const GRAPH_SLASH_COMMAND: SlashCommand = {
  label: "/graph",
  insertText: "",
  detail: "📈 Insert a Graphviz diagram",
  isAction: true,
  commandId: Cmd.insertGraph,
  kind: 14,
  handler: handleGraphCommand,
};

const RENDER_GRAPH_SLASH_COMMAND: SlashCommand = {
  label: "/render",
  insertText: "",
  detail: "▶ Re-render graph from DOT source",
  isAction: true,
  commandId: Cmd.renderGraph,
  kind: 2,
  when: cursorInGraph,
  handler: handleRenderGraphCommand,
};

// ── Graphviz diagram block ─────────────────────────────────────────
//
// Structure in markdown:
//
//   <details open>
//   <summary>
//
//   ![graph](.rsrc/graph-<hash>.svg)
//
//   </summary>
//
//   ```dot
//   digraph G { ... }
//   ```
//
//   </details>
//
// /graph  — insert a template block
// /render — re-render the SVG file from the DOT source

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

async function renderDot(dot: string): Promise<string> {
  const viz = await getViz();
  return viz.renderString(dot, { format: "svg" }) as string;
}

/** Generate a short hash from DOT source for unique filenames. */
function dotHash(dot: string): string {
  return crypto.createHash("sha256").update(dot).digest("hex").slice(0, 8);
}

/** Write SVG to .rsrc/ and return the relative path for markdown. */
function writeSvgFile(cwd: string, svg: string, dot: string): string {
  const rsrcDir = path.join(cwd, ".rsrc");
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
  }
  const filename = `graph-${dotHash(dot)}.svg`;
  const absPath = path.join(rsrcDir, filename);
  fs.writeFileSync(absPath, svg, "utf-8");
  return `.rsrc/${filename}`;
}

// ── Default template ───────────────────────────────────────────────

const DEFAULT_DOT = `digraph G {
  rankdir=LR
  A -> B -> C
  B -> D
}`;

// ── /graph handler — insert a new graph block ──────────────────────

export async function handleGraphCommand(document: TextDocument, position: Position): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  let svg: string;
  try {
    svg = await renderDot(DEFAULT_DOT);
  } catch (err: any) {
    hostEditor.showError(`Lotion: Graphviz render failed — ${err.message}`);
    return;
  }

  const relPath = writeSvgFile(cwd, svg, DEFAULT_DOT);
  const block = buildBlock(relPath, DEFAULT_DOT);

  await hostEditor.showTextDocument(document);
  await hostEditor.insertAt(position, block);

  hostEditor.showInformation("Graph inserted — edit the DOT source and use /render to update.");
}

// ── /render handler — re-render the SVG in enclosing graph block ───

export async function handleRenderGraphCommand(document: TextDocument, position: Position): Promise<void> {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  const block = findGraphBlock(document, position.line);
  if (!block) {
    hostEditor.showError("Lotion: place cursor inside a graph <details> block to render.");
    return;
  }

  const dot = block.dotSource;
  if (!dot.trim()) {
    hostEditor.showWarning("DOT source is empty — nothing to render.");
    return;
  }

  let svg: string;
  try {
    svg = await renderDot(dot);
  } catch (err: any) {
    hostEditor.showError(`Lotion: Graphviz error — ${err.message}`);
    return;
  }

  // Delete old SVG file if the image path changed
  if (block.imagePath) {
    const oldAbs = path.resolve(cwd, block.imagePath);
    if (fs.existsSync(oldAbs)) {
      fs.unlinkSync(oldAbs);
    }
  }

  const relPath = writeSvgFile(cwd, svg, dot);

  // Replace summary content with updated image link
  await hostEditor.showTextDocument(document);
  const summaryRange = new Range(
    new Position(block.summaryContentStart, 0),
    new Position(block.summaryContentEnd + 1, 0),
  );

  await hostEditor.replaceRange(summaryRange, `\n![graph](${relPath})\n\n`);
  await hostEditor.saveActiveDocument();

  hostEditor.showInformation("Graph re-rendered.");
}

// ── CodeLens provider ──────────────────────────────────────────────

export function generateGraphLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    // Look for <details> that is followed (within 10 lines) by a ```dot block
    if (!Regex.detailsOpenLine.test(line)) {
      continue;
    }

    for (let j = i + 1; j < Math.min(i + 15, document.lineCount); j++) {
      if (Regex.dotFenceOpenLine.test(document.lineAt(j).text)) {
        lenses.push(
          codeLens(i, "▶ Render graph", Cmd.renderGraph, [document.uri.toString(), i, 0], {
            endChar: line.length,
          }),
        );
        break;
      }
      // Stop if we hit </details> before finding ```dot
      if (Regex.detailsCloseLine.test(document.lineAt(j).text)) {
        break;
      }
    }
  }

  return lenses;
}

// ── Predicate for slash commands ───────────────────────────────────

export function cursorInGraph(document: TextDocument, position: Position): boolean {
  return findGraphBlock(document, position.line) !== null;
}

// ── Block detection ────────────────────────────────────────────────

interface GraphBlock {
  detailsStart: number;
  detailsEnd: number;
  /** First line of summary content (between <summary> and </summary>) */
  summaryContentStart: number;
  /** Last line of summary content (exclusive of </summary> line) */
  summaryContentEnd: number;
  /** The DOT source code */
  dotSource: string;
  /** The existing image path from ![graph](...), if any */
  imagePath?: string;
}

function findGraphBlock(document: TextDocument, cursorLine: number): GraphBlock | null {
  const lineCount = document.lineCount;

  // Search upward for <details
  let detailsStart = -1;
  for (let i = cursorLine; i >= 0; i--) {
    if (/^\s*<details/i.test(document.lineAt(i).text)) {
      detailsStart = i;
      break;
    }
  }
  if (detailsStart === -1) {
    return null;
  }

  // Search downward for </details>
  let detailsEnd = -1;
  for (let i = Math.max(cursorLine, detailsStart + 1); i < lineCount; i++) {
    if (/^\s*<\/details>/i.test(document.lineAt(i).text)) {
      detailsEnd = i;
      break;
    }
  }
  if (detailsEnd === -1) {
    return null;
  }

  // Verify cursor is inside
  if (cursorLine < detailsStart || cursorLine > detailsEnd) {
    return null;
  }

  // Find <summary> and </summary>
  let summaryStart = -1;
  let summaryEnd = -1;
  for (let i = detailsStart; i <= detailsEnd; i++) {
    const text = document.lineAt(i).text;
    if (summaryStart === -1 && Regex.summaryTagOpen.test(text)) {
      summaryStart = i;
    }
    if (summaryStart !== -1 && Regex.summaryTagClose.test(text)) {
      summaryEnd = i;
      break;
    }
  }
  if (summaryStart === -1 || summaryEnd === -1) {
    return null;
  }

  // Find ```dot ... ``` inside the block
  let dotStart = -1;
  let dotEnd = -1;
  for (let i = summaryEnd + 1; i < detailsEnd; i++) {
    const text = document.lineAt(i).text;
    if (dotStart === -1 && Regex.dotFenceOpenLine.test(text)) {
      dotStart = i;
      continue;
    }
    if (dotStart !== -1 && Regex.anyFenceCloseLine.test(text)) {
      dotEnd = i;
      break;
    }
  }
  if (dotStart === -1 || dotEnd === -1) {
    return null;
  }

  // Extract DOT source
  const dotLines: string[] = [];
  for (let i = dotStart + 1; i < dotEnd; i++) {
    dotLines.push(document.lineAt(i).text);
  }

  // Summary content is between the <summary> line and </summary> line
  const summaryContentStart = summaryStart + 1;
  const summaryContentEnd = summaryEnd - 1;

  // Try to extract existing image path from summary
  let imagePath: string | undefined;
  for (let i = summaryContentStart; i <= summaryContentEnd; i++) {
    const m = document.lineAt(i).text.match(Regex.markdownImageSimple);
    if (m) {
      imagePath = m[1];
      break;
    }
  }

  return {
    detailsStart,
    detailsEnd,
    summaryContentStart,
    summaryContentEnd,
    dotSource: dotLines.join("\n"),
    imagePath,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function buildBlock(imagePath: string, dot: string): string {
  return [
    "<details open>",
    "<summary>",
    "",
    `![graph](${imagePath})`,
    "",
    "</summary>",
    "",
    "```dot",
    dot,
    "```",
    "",
    "</details>",
    "",
  ].join("\n");
}
