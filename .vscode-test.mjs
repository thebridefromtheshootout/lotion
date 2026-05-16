import { defineConfig } from "@vscode/test-cli";

// Integration test runner — launches a real VS Code, loads the
// compiled extension from ./out, and runs the compiled tests at
// ./out/test/**/*.test.js. Keep this lean: the Jest suite under
// src/__tests__ stays the home for pure-helper unit tests.
export default defineConfig({
  files: "out/test/**/*.test.js",
  workspaceFolder: "src/test/fixtures",
  mocha: {
    ui: "bdd",
    timeout: 20000,
  },
});
