#!/usr/bin/env node
// Regenerates the slash-command table in README.md between sentinel comments.
// Source of truth: object literals across src/ that define { label: "/x", detail: "y" }.
// Run via `npm run docs:slash-table`. CI guard: `npm run docs:check`.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SRC = join(ROOT, "src");
const README = join(ROOT, "README.md");
const BEGIN = "<!-- BEGIN AUTO-SLASH-TABLE -->";
const END = "<!-- END AUTO-SLASH-TABLE -->";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "test" || name === "webview") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) out.push(full);
  }
  return out;
}

// Matches `label: "/foo"` and the nearest following `detail: "..."` within the
// same object literal. The 500-char gap is well above any current entry; if a
// future entry exceeds it the row simply drops and the docs:check guard fires.
const RE = /label:\s*"(\/[\w-]+)"[\s\S]{0,500}?detail:\s*"((?:[^"\\]|\\.)*)"/g;

function decodeDetail(raw) {
  // The captured string is a TS source literal; JSON parsing handles \uXXXX,
  // \n, \", \\ etc. uniformly. Wrap and parse.
  return JSON.parse(`"${raw}"`);
}

function extract() {
  const seen = new Map();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(RE)) {
      const [, label, detailRaw] = m;
      if (!seen.has(label)) seen.set(label, decodeDetail(detailRaw));
    }
  }
  return seen;
}

function buildTable(entries) {
  const rows = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lines = ["| Command | Description |", "| --- | --- |"];
  for (const [label, detail] of rows) {
    lines.push(`| \`${label}\` | ${detail} |`);
  }
  return lines.join("\n");
}

async function updateReadme(table) {
  const text = readFileSync(README, "utf8");
  const beginIdx = text.indexOf(BEGIN);
  const endIdx = text.indexOf(END);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(`Sentinels not found in README.md. Add ${BEGIN} and ${END} where the table should live.`);
  }
  const block = `${BEGIN}\n${table}\n${END}`;
  const next = text.slice(0, beginIdx) + block + text.slice(endIdx + END.length);
  // Pipe through prettier so the output is byte-stable across reruns —
  // otherwise prettier's table-padding pass would diverge from ours and
  // docs:check would flap.
  const prettierConfig = (await prettier.resolveConfig(README)) ?? {};
  const formatted = await prettier.format(next, { ...prettierConfig, filepath: README });
  if (formatted !== text) {
    writeFileSync(README, formatted);
    return true;
  }
  return false;
}

const entries = extract();
const table = buildTable(entries);
const changed = await updateReadme(table);
console.log(`[docs] slash-table: ${entries.size} commands ${changed ? "(updated)" : "(unchanged)"}`);
