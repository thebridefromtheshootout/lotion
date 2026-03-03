import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const opts = {
  entryPoints: ["src/webview/apps/*.tsx"],
  bundle: true,
  outdir: "out/webview",
  format: "iife",
  target: "es2020",
  platform: "browser",
  jsx: "automatic",
  minify: !watch,
  sourcemap: watch,
  loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css", ".png": "dataurl" },
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log("Watching webview…");
} else {
  await esbuild.build(opts);
  console.log("Webview built.");
}
