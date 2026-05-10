import { Disposable, Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Markers } from "../core/markers";
import { getBlockIndex } from "../core/blockIndex";
import { encrypt } from "./lockBlockCrypto";
import { enrichDetailsBlock } from "./lockBlockDetails";
import type { DetailsBlock } from "./lockBlockDetails";
import { withGuardSuppressed } from "./lockBlockGuards";
import { readLastPassword, touchLastPassword } from "./lockBlockPassword";

// ── Has-unlocked detection ─────────────────────────────────────────

function hasUnlockedSecretbox(document: TextDocument): boolean {
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) return true;
  }
  return false;
}

// ── Lock-all-boxes batch helper ────────────────────────────────────

/**
 * Lock every unlocked secretbox in the document.
 * Prompts for a single password and reuses it for all boxes.
 */
async function lockAllBoxes(document: TextDocument): Promise<boolean> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return false;
  }

  const blocks: DetailsBlock[] = [];
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) blocks.push(block);
  }
  if (blocks.length === 0) {
    return true;
  }

  const password = await hostEditor.showInputBox({
    prompt: `Password to lock ${blocks.length} secret box${blocks.length > 1 ? "es" : ""}`,
    password: true,
    value: readLastPassword(),
    validateInput: (v) => (!v || v.length === 0 ? "Password cannot be empty" : undefined),
  });
  if (!password) {
    return false;
  }
  touchLastPassword(password);

  // Lock bottom-up so earlier line numbers remain valid
  blocks.sort((a, b) => b.startLine - a.startLine);
  await withGuardSuppressed(async () => {
    for (const block of blocks) {
      const plaintext = block.bodyLines.join("\n");
      if (!plaintext.trim()) {
        continue;
      }

      const blob = encrypt(plaintext, password);
      const lockedSummary = `<summary>🔒 ${block.summaryText}</summary>`;
      const lockedBody = ["", "`🔒 ENCRYPTED — use /unlock to decrypt`", "", `<!--${Markers.lockPrefix}:${blob}-->`].join("\n");

      const bodyStart = new Position(block.summaryEndLine, 0);
      const bodyEnd = new Position(block.endLine, 0);
      const replaceRange = new Range(bodyStart, bodyEnd);

      await hostEditor.replaceRange(replaceRange, lockedSummary + "\n" + lockedBody + "\n");
    }
  });
  return true;
}

// ── Save guard ─────────────────────────────────────────────────────

/**
 * Prevents saving a markdown file that contains unlocked (unencrypted)
 * secretboxes. The save is blocked and the user is warned.
 *
 * Implementation: overrides the built-in `workbench.action.files.save`
 * command. For markdown documents with unlocked boxes it shows a
 * warning; for everything else it delegates to the real save.
 */
export function createSecretboxSaveGuard(): Disposable {
  return hostEditor.registerCommand("workbench.action.files.save", async () => {
    if (!hostEditor.isMarkdownEditor()) {
      // Delegate to the real save via the document API (bypasses our override)
      if (hostEditor.getDocument()) {
        await hostEditor.saveActiveDocument();
      }
      return;
    }
    const doc = hostEditor.getDocument()!;
    if (hasUnlockedSecretbox(doc)) {
      const choice = await hostEditor.showWarningModal(
        "Lotion: This file contains an unlocked secret box. " +
          "Saving the unencrypted content to disk is unsafe. " +
          "Lock all secret boxes before saving.",
        ["Lock All Boxes", "Save Anyway"],
      );
      if (choice === "Lock All Boxes") {
        const locked = await lockAllBoxes(doc);
        if (locked) {
          await hostEditor.saveActiveDocument();
        }
        return;
      }
      if (choice !== "Save Anyway") {
        return; // user cancelled — do not save
      }
    }

    await hostEditor.saveActiveDocument();
  });
}
