import * as assert from "assert";
import * as vscode from "vscode";
import { EXTENSION_ID, activate } from "./_helpers";

// Activation smoke test. Verifies the extension loads inside a real
// VS Code instance and registers a representative command. If this
// passes, the integration harness is wired correctly.
describe("Lotion extension activation", () => {
  it("extension is present and activates", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, "extension should be discoverable by id");
    await activate();
    assert.strictEqual(ext!.isActive, true, "extension should be active after activate()");
  });

  it("a known command is registered after activation", async () => {
    await activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("lotion.listContinue"),
      "lotion.listContinue should be registered by the extension",
    );
  });
});
