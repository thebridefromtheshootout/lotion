import { Position, Range, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Markers } from "../core/markers";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

import { encrypt, decrypt } from "./lockBlockCrypto";
import { findDetailsBlock } from "./lockBlockDetails";
import { withGuardSuppressed } from "./lockBlockGuards";
import { readLastPassword, touchLastPassword } from "./lockBlockPassword";

// ── Slash command exports ──────────────────────────────────────────

export const SECRETBOX_SLASH_COMMAND: SlashCommand = {
  label: "/secretbox",
  insertText: "",
  detail: "🔐 Secret box — lockable <details> block",
  isAction: true,
  commandId: Cmd.insertSecretbox,
  kind: 5,
  cmdFilter: Filter().pageIsNotDbIndex().cursorAllowsBlockMarkdown(),
  handler: handleSecretboxCommand,
  cleanLine: true,
};

export const LOCK_SLASH_COMMAND: SlashCommand = {
  label: "/lock",
  insertText: "",
  detail: "🔒 Encrypt a secret box with a password",
  isAction: true,
  commandId: Cmd.lockBlock,
  kind: 5,
  cmdFilter: Filter().cursorInSecretbox(),
  handler: handleLockCommand,
};

export const UNLOCK_SLASH_COMMAND: SlashCommand = {
  label: "/unlock",
  insertText: "",
  detail: "🔓 Decrypt a locked secret box",
  isAction: true,
  commandId: Cmd.unlockBlock,
  kind: 5,
  cmdFilter: Filter().cursorInSecretbox(),
  handler: handleUnlockCommand,
};

// ── Re-exports for the public API ──────────────────────────────────

export { cursorInSecretbox } from "./lockBlockDetails";
export { createSecretboxGuard } from "./lockBlockGuards";
export { createSecretboxSaveGuard } from "./lockBlockSaveGuard";
export { encrypt, decrypt } from "./lockBlockCrypto";

// ── /lock handler ──────────────────────────────────────────────────

export async function handleLockCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const block = findDetailsBlock(document, position.line);
  if (!block) {
    hostEditor.showError("Lotion: place cursor inside a secret box to lock it. Use /secretbox to create one.");
    return;
  }

  if (!block.isSecretbox) {
    hostEditor.showError("Lotion: /lock only works inside a secret box. Use /secretbox to create one first.");
    return;
  }

  if (block.isEncrypted) {
    hostEditor.showInformation("This block is already locked.");
    return;
  }

  const plaintext = block.bodyLines.join("\n");
  if (plaintext.trim().length === 0) {
    hostEditor.showWarning("Nothing to encrypt — block body is empty.");
    return;
  }

  const password = await hostEditor.showInputBox({
    prompt: "Password to encrypt this block",
    password: true,
    value: readLastPassword(),
    validateInput: (v) => {
      if (!v || v.length === 0) {
        return "Password cannot be empty";
      }
      return undefined;
    },
  });
  if (!password) {
    return;
  }
  touchLastPassword(password);

  const blob = encrypt(plaintext, password);

  const lockedSummary = `<summary>🔒 ${block.summaryText}</summary>`;
  const lockedBody = ["", "`🔒 ENCRYPTED — use /unlock to decrypt`", "", `<!--${Markers.lockPrefix}:${blob}-->`].join("\n");

  const bodyStart = new Position(block.summaryEndLine, 0);
  const bodyEnd = new Position(block.endLine, 0);
  const replaceRange = new Range(bodyStart, bodyEnd);

  await withGuardSuppressed(() => hostEditor.replaceRange(replaceRange, lockedSummary + "\n" + lockedBody + "\n"));
  await hostEditor.saveActiveDocument();

  hostEditor.showInformation(`🔒 Block "${block.summaryText}" locked.`);
}

// ── /unlock handler ────────────────────────────────────────────────

export async function handleUnlockCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const block = findDetailsBlock(document, position.line);
  if (!block) {
    hostEditor.showError("Lotion: place cursor inside a secret box to unlock it.");
    return;
  }

  if (!block.isSecretbox) {
    hostEditor.showError("Lotion: /unlock only works inside a secret box.");
    return;
  }

  if (!block.isEncrypted || !block.encryptedBlob) {
    hostEditor.showInformation("This block is not encrypted.");
    return;
  }

  const password = await hostEditor.showInputBox({
    prompt: "Password to decrypt this block",
    password: true,
    validateInput: (v) => {
      if (!v || v.length === 0) {
        return "Password cannot be empty";
      }
      return undefined;
    },
  });
  if (!password) {
    return;
  }

  const plaintext = decrypt(block.encryptedBlob, password);
  if (plaintext === undefined) {
    hostEditor.showError("Wrong password or corrupted data.");
    return;
  }
  touchLastPassword(password);

  const unlockedSummary = `<summary>${block.summaryText}</summary>`;

  const bodyStart = new Position(block.summaryEndLine, 0);
  const bodyEnd = new Position(block.endLine, 0);
  const replaceRange = new Range(bodyStart, bodyEnd);

  await hostEditor.replaceRange(replaceRange, unlockedSummary + "\n" + plaintext + "\n");
  await hostEditor.saveActiveDocument();

  hostEditor.showInformation(`🔓 Block "${block.summaryText}" unlocked.`);
}

// ── /secretbox handler ─────────────────────────────────────────────

/**
 * Create a secret box — a <details> block marked with <!--lotion-secretbox-->
 * that can be locked/unlocked with a password.
 */
export async function handleSecretboxCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  // Insert as a snippet so the user can tab between summary and body
  const snippet = new SnippetString(
    "<details>" +
      Markers.secretboxMarkerHtml +
      "\n" +
      "<summary>${1:Secret title}</summary>\n" +
      "\n" +
      "${2:Content to protect — use /lock to encrypt this block}\n" +
      "\n" +
      "</details>\n",
  );

  // Replace the "/" trigger if called from slash-command
  const lineText = document.lineAt(position.line).text;
  const slashIdx = lineText.lastIndexOf("/", position.character);
  if (slashIdx >= 0) {
    const replaceRange = new Range(position.line, slashIdx, position.line, position.character);
    await hostEditor.insertSnippet(snippet, replaceRange);
  } else {
    await hostEditor.insertSnippet(snippet, position);
  }
}
