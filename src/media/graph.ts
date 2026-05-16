import { CodeLens, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Cmd } from "../core/commands";
import { codeLens } from "../core/codeLens";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

import { renderDot, writeSvgFile } from "./graphRender";
import { buildBlock, findGraphBlock } from "./graphBlock";

// ── Re-exports ─────────────────────────────────────────────────────

export { cursorInGraph } from "./graphBlock";

// ── Slash commands ─────────────────────────────────────────────────

export const GRAPH_SLASH_COMMAND: SlashCommand = {
  label: "/graph",
  insertText: "",
  detail: "📈 Insert a Graphviz diagram",
  isAction: true,
  commandId: Cmd.insertGraph,
  kind: 14,
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  handler: handleGraphCommand,
  cleanLine: true,
};

export const RENDER_GRAPH_SLASH_COMMAND: SlashCommand = {
  label: "/render",
  insertText: "",
  detail: "▶ Re-render graph from DOT source",
  isAction: true,
  commandId: Cmd.renderGraph,
  kind: 2,
  cmdFilter: Filter().cursorInGraph(),
  handler: handleRenderGraphCommand,
};

// ── Default DOT template ───────────────────────────────────────────

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
