#!/usr/bin/env node
// ── Publish workflow ───────────────────────────────────────────────
// 1. Bump package.json version (patch by default; `-- minor` or `-- major` for other)
// 2. Package via `vsce package`
// 3. Move the produced .vsix into latest-vsix/, deleting any old .vsix there
// 4. Commit + push
//
// Invoke as `npm run publish` or `npm run publish -- minor`.

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, unlinkSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const VSIX_DIR = "latest-vsix";

const bumpType = process.argv[2] || "patch";
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error(`publish: unknown bump type "${bumpType}" (expected patch|minor|major)`);
  process.exit(1);
}

function run(cmd) {
  console.log(`+ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// Bail if there are uncommitted tracked changes — the workflow is meant
// to snapshot a clean state, not sweep in unrelated work.
const dirty = execSync("git status --porcelain --untracked-files=no").toString().trim();
if (dirty) {
  console.error("publish: tracked files are dirty; commit or stash first:");
  console.error(dirty);
  process.exit(1);
}

run(`npm version ${bumpType} --no-git-tag-version`);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const newVersion = pkg.version;
console.log(`publish: bumped to ${newVersion}`);

if (!existsSync(VSIX_DIR)) mkdirSync(VSIX_DIR);
for (const f of readdirSync(VSIX_DIR)) {
  if (f.endsWith(".vsix")) {
    unlinkSync(join(VSIX_DIR, f));
    console.log(`publish: removed old ${VSIX_DIR}/${f}`);
  }
}

run("npx vsce package");

const producedVsix = `lotion-${newVersion}.vsix`;
renameSync(producedVsix, join(VSIX_DIR, producedVsix));
console.log(`publish: moved ${producedVsix} → ${VSIX_DIR}/`);

run(`git add package.json package-lock.json README.md ${VSIX_DIR}`);
run(`git commit -m "Release v${newVersion}"`);
run("git push");
