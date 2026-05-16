import * as assert from "assert";
import * as vscode from "vscode";

// Activation smoke test. Verifies that the extension loads inside a
// real VS Code instance and that a representative slash-command id
// is registered. If this passes, the integration harness is wired.
describe("Lotion extension activation", () => {
  it("extension is present and activates", async () => {
    const ext = vscode.extensions.getExtension("thebridefromtheshootout.lotion");
    assert.ok(ext, "extension should be discoverable by id");
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true, "extension should be active after activate()");
  });

  it("a known command is registered after activation", async () => {
    const ext = vscode.extensions.getExtension("thebridefromtheshootout.lotion");
    await ext!.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("lotion.listContinue"),
      "lotion.listContinue should be registered by the extension",
    );
  });
});
