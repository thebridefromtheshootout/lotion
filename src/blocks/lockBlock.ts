import { Disposable, Position, Range, Selection, SnippetString } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as crypto from "crypto";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import { getBlockIndex } from "../core/blockIndex";
import type { DetailsBlock as IndexedDetailsBlock } from "../core/blockIndex";
import type { SlashCommand } from "../core/slashCommands";
import { Filter } from "../core/cmdFilter";

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

// ── Encryption config ──────────────────────────────────────────────
//
// Blob format is versioned: existing v1 blobs (4 dot-separated base64
// segments: SALT.IV.TAG.CIPHERTEXT) keep their 100k iteration count
// forever so old data still decrypts. New blobs use v2 (5 segments,
// "v2.SALT.IV.TAG.CIPHERTEXT") with 600k PBKDF2-SHA512 iterations to
// match OWASP 2023 guidance.

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;
const TAG_LEN = 16;
const PBKDF2_ITERATIONS_V1 = 100_000;
const PBKDF2_ITERATIONS_V2 = 600_000;
const PBKDF2_DIGEST = "sha512";
const BLOB_VERSION_V2 = "v2";

const LOCK_MARKER_RE = Regex.lockMarker;
const SECRETBOX_MARKER = "<!--lotion-secretbox-->";
const SECRETBOX_TAG_RE = Regex.secretboxTagLine;

// ── Last-password memo (TTL-bounded) ───────────────────────────────
// Convenience for users who lock/unlock several boxes back-to-back. The
// password is held in memory only — never persisted — and is wiped after
// PASSWORD_TTL_MS so a long-lived extension host can't accumulate
// secrets indefinitely. Prefer touchLastPassword() / readLastPassword()
// over poking lastPassword directly.
const PASSWORD_TTL_MS = 5 * 60 * 1000; // 5 minutes
let lastPassword: string | undefined;
let lastPasswordExpiry = 0;
let lastPasswordTimer: ReturnType<typeof setTimeout> | undefined;

function touchLastPassword(password: string): void {
  lastPassword = password;
  lastPasswordExpiry = Date.now() + PASSWORD_TTL_MS;
  if (lastPasswordTimer) clearTimeout(lastPasswordTimer);
  lastPasswordTimer = setTimeout(clearLastPassword, PASSWORD_TTL_MS);
}

function readLastPassword(): string | undefined {
  if (lastPassword && Date.now() < lastPasswordExpiry) return lastPassword;
  if (lastPassword) clearLastPassword();
  return undefined;
}

function clearLastPassword(): void {
  lastPassword = undefined;
  lastPasswordExpiry = 0;
  if (lastPasswordTimer) {
    clearTimeout(lastPasswordTimer);
    lastPasswordTimer = undefined;
  }
}

/** Run an async block with the read-only guard suppressed (try/finally safe). */
let _guardSuppressed = false;
async function withGuardSuppressed<T>(fn: () => PromiseLike<T> | T): Promise<T> {
  _guardSuppressed = true;
  try {
    return await fn();
  } finally {
    _guardSuppressed = false;
  }
}

// ── Encrypted-body read-only guard ─────────────────────────────────

/**
 * Finds all encrypted secretbox body ranges in a document.
 * Returns an array of [startLine, endLine] (inclusive) covering the body
 * of each locked secretbox (between </summary> and </details>).
 */
function getEncryptedRanges(document: TextDocument): [number, number][] {
  const ranges: [number, number][] = [];
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) continue;
    if (block.summaryEndLine + 1 < block.endLine) {
      ranges.push([block.summaryEndLine + 1, block.endLine - 1]);
    }
  }
  return ranges;
}

/**
 * Finds all encrypted secretbox displacement zones in a document.
 * Returns an array of { guardStart, guardEnd, summaryLine, detailsEndLine }
 * where the displacement zone covers summaryEndLine+1 through endLine (inclusive,
 * i.e. including the </details> tag).
 */
function getEncryptedZones(
  document: TextDocument,
): { guardStart: number; guardEnd: number; summaryLine: number; afterLine: number }[] {
  const zones: { guardStart: number; guardEnd: number; summaryLine: number; afterLine: number }[] = [];
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) continue;
    if (block.summaryEndLine + 1 <= block.endLine) {
      zones.push({
        guardStart: block.summaryEndLine + 1,
        guardEnd: block.endLine,
        summaryLine: block.summaryEndLine,
        afterLine: Math.min(block.endLine + 1, document.lineCount - 1),
      });
    }
  }
  return zones;
}

/**
 * Creates a disposable that prevents edits inside encrypted secretbox bodies.
 *
 * Two-layer defense:
 * 1. **Cursor displacement** — if the cursor enters an encrypted body range,
 *    it is direction-aware: moving down/right skips past the secretbox;
 *    moving up/left lands inside the summary text.
 * 2. **Edit-undo fallback** — any edit that still manages to touch a guarded
 *    range (e.g. programmatic edits, multi-cursor paste) is undone.
 */
export function createSecretboxGuard(): Disposable {
  let reverting = false;
  let displacingCursor = false;
  let lastWarningTime = 0;
  let prevLine = -1;
  let prevCol = -1;

  function warnOnce() {
    const now = Date.now();
    if (now - lastWarningTime > 2000) {
      lastWarningTime = now;
      hostEditor.showWarning("Lotion: Cannot edit encrypted secretbox content. Use /unlock first.");
    }
  }

  // ── Layer 1: direction-aware cursor displacement ─────────────────
  const selectionGuard = hostEditor.onDidChangeTextEditorSelection(() => {
    if (displacingCursor || _guardSuppressed) {
      return;
    }
    const doc = hostEditor.getDocument();
    if (!doc || doc.languageId !== "markdown") {
      return;
    }
    const zones = getEncryptedZones(doc);
    if (zones.length === 0) {
      // Track position even when no zones (cursor might enter one next time)
      const sel = hostEditor.getSelections()[0];
      if (sel) {
        prevLine = sel.active.line;
        prevCol = sel.active.character;
      }
      return;
    }

    const selections = hostEditor.getSelections();
    let needsDisplacement = false;
    const safeSelections = selections.map((sel) => {
      for (const zone of zones) {
        const activeInside =
          sel.active.line >= zone.guardStart && sel.active.line <= zone.guardEnd;
        const anchorInside =
          sel.anchor.line >= zone.guardStart && sel.anchor.line <= zone.guardEnd;
        if (!activeInside && !anchorInside) {
          continue;
        }
        needsDisplacement = true;

        // Determine direction: compare current active position with previous
        const curLine = sel.active.line;
        const curCol = sel.active.character;
        const movingDown =
          prevLine < 0 ||
          curLine > prevLine ||
          (curLine === prevLine && curCol > prevCol);

        // Compute the safe active position
        let safeActive: Position;
        if (movingDown) {
          safeActive = new Position(zone.afterLine, 0);
        } else {
          const summaryText = doc.lineAt(zone.summaryLine).text;
          const closingIdx = summaryText.indexOf("</summary>");
          const safeCol = closingIdx >= 0 ? closingIdx : summaryText.length;
          safeActive = new Position(zone.summaryLine, safeCol);
        }

        // Compute the safe anchor position (preserve anchor if it's outside)
        let safeAnchor: Position;
        if (anchorInside) {
          // Both ends inside — collapse to the safe active position
          safeAnchor = safeActive;
        } else {
          // Anchor is outside the zone — keep it to preserve the selection
          safeAnchor = sel.anchor;
        }

        return new Selection(safeAnchor, safeActive);
      }
      return sel;
    });

    if (needsDisplacement) {
      displacingCursor = true;
      hostEditor.setSelections(safeSelections);
      displacingCursor = false;
      // Update tracked position to the displaced position
      const displaced = safeSelections[0];
      if (displaced) {
        prevLine = displaced.active.line;
        prevCol = displaced.active.character;
      }
      warnOnce();
    } else {
      const sel = selections[0];
      if (sel) {
        prevLine = sel.active.line;
        prevCol = sel.active.character;
      }
    }
  });

  // ── Layer 2: edit-undo fallback ──────────────────────────────────
  const editGuard = hostEditor.onDidChangeTextDocument((e) => {
    if (reverting || _guardSuppressed) {
      return;
    }
    if (e.document.languageId !== "markdown") {
      return;
    }
    if (e.contentChanges.length === 0) {
      return;
    }

    const ranges = getEncryptedRanges(e.document);
    if (ranges.length === 0) {
      return;
    }

    for (const change of e.contentChanges) {
      const changeLine = change.range.start.line;
      const changeEndLine = change.range.end.line;

      for (const [guardStart, guardEnd] of ranges) {
        if (changeLine <= guardEnd && changeEndLine >= guardStart) {
          reverting = true;
          hostEditor.executeCommand("undo").then(() => {
            reverting = false;
            warnOnce();
          });
          return;
        }
      }
    }
  });

  return {
    dispose() {
      selectionGuard.dispose();
      editGuard.dispose();
    },
  };
}

// ── Crypto helpers ─────────────────────────────────────────────────

function deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, PBKDF2_DIGEST);
}

/** Exported for unit tests; not part of the public surface. */
export function encrypt(plaintext: string, password: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt, PBKDF2_ITERATIONS_V2);

  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // v2 format: VERSION.SALT.IV.TAG.CIPHERTEXT (all base64 except VERSION)
  return [
    BLOB_VERSION_V2,
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

/** Exported for unit tests; not part of the public surface. */
export function decrypt(blob: string, password: string): string | undefined {
  const parts = blob.split(".");
  let saltB64: string, ivB64: string, tagB64: string, ctB64: string;
  let iterations: number;
  if (parts.length === 5 && parts[0] === BLOB_VERSION_V2) {
    [, saltB64, ivB64, tagB64, ctB64] = parts;
    iterations = PBKDF2_ITERATIONS_V2;
  } else if (parts.length === 4) {
    // Legacy v1 blobs — keep accepting them at the original iteration count.
    [saltB64, ivB64, tagB64, ctB64] = parts;
    iterations = PBKDF2_ITERATIONS_V1;
  } else {
    return undefined;
  }

  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const key = deriveKey(password, salt, iterations);

  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf-8");
  } catch {
    return undefined; // wrong password or corrupted
  }
}

// ── Block detection helpers ────────────────────────────────────────

interface DetailsBlock {
  /** Line number of <details> */
  startLine: number;
  /** Line number of </details> */
  endLine: number;
  /** Line number of the closing </summary> tag (or the line containing it) */
  summaryEndLine: number;
  /** The summary text (plain, without 🔒) */
  summaryText: string;
  /** Lines between end-of-summary and </details> (the "body") */
  bodyLines: string[];
  /** Whether the block is currently encrypted */
  isEncrypted: boolean;
  /** If encrypted, the blob string */
  encryptedBlob?: string;
  /** Whether this is a lotion secretbox */
  isSecretbox: boolean;
}

function findDetailsBlock(document: TextDocument, cursorLine: number): DetailsBlock | undefined {
  const indexed = getBlockIndex(document).detailsBlockAt(cursorLine);
  if (!indexed) return undefined;
  return enrichDetailsBlock(document, indexed);
}

/**
 * Enrich an indexed DetailsBlock with the runtime data lockBlock handlers need:
 * collected body lines, lock-marker detection, and isSecretbox flag.
 */
function enrichDetailsBlock(document: TextDocument, indexed: IndexedDetailsBlock): DetailsBlock {
  const bodyLines: string[] = [];
  for (let i = indexed.bodyStartLine; i <= indexed.bodyEndLine; i++) {
    bodyLines.push(document.lineAt(i).text);
  }

  let isEncrypted = false;
  let encryptedBlob: string | undefined;
  for (const line of bodyLines) {
    const m = line.trim().match(LOCK_MARKER_RE);
    if (m) {
      isEncrypted = true;
      encryptedBlob = m[1];
      break;
    }
  }

  return {
    startLine: indexed.startLine,
    endLine: indexed.endLine,
    summaryEndLine: indexed.summaryEndLine,
    summaryText: indexed.summaryText,
    bodyLines,
    isEncrypted,
    encryptedBlob,
    isSecretbox: indexed.kind === "secretbox",
  };
}

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

  // Get the body content to encrypt
  const plaintext = block.bodyLines.join("\n");
  if (plaintext.trim().length === 0) {
    hostEditor.showWarning("Nothing to encrypt — block body is empty.");
    return;
  }

  // Prompt for password
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

  // Encrypt
  const blob = encrypt(plaintext, password);

  // Build replacement: locked summary + encrypted body
  const lockedSummary = `<summary>🔒 ${block.summaryText}</summary>`;
  const lockedBody = ["", "`🔒 ENCRYPTED — use /unlock to decrypt`", "", `<!--lotion-lock:${blob}-->`].join("\n");

  // Replace the summary line and body
  const summaryLine = document.lineAt(block.summaryEndLine);
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

  // Prompt for password
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

  // Decrypt
  const plaintext = decrypt(block.encryptedBlob, password);
  if (plaintext === undefined) {
    hostEditor.showError("Wrong password or corrupted data.");
    return;
  }
  touchLastPassword(password);

  // Build replacement: unlocked summary + decrypted body
  const unlockedSummary = `<summary>${block.summaryText}</summary>`;

  // Replace the summary line and body
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
      SECRETBOX_MARKER +
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

// ── Predicates ─────────────────────────────────────────────────────

/**
 * True when the cursor is inside a lotion secretbox (<!--lotion-secretbox-->).
 */
export function cursorInSecretbox(document: TextDocument, position: Position): boolean {
  const block = findDetailsBlock(document, position.line);
  return block !== undefined && block.isSecretbox;
}

/**
 * Returns true if `document` contains at least one secretbox whose body
 * is **not** encrypted (i.e. plaintext is exposed).
 */
function hasUnlockedSecretbox(document: TextDocument): boolean {
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) return true;
  }
  return false;
}

/**
 * Lock every unlocked secretbox in the document.
 * Prompts for a single password and reuses it for all boxes.
 */
async function lockAllBoxes(document: TextDocument): Promise<boolean> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return false;
  }

  // Collect all unlocked secretbox blocks (scan bottom-up so line numbers stay valid)
  const blocks: DetailsBlock[] = [];
  for (const indexed of getBlockIndex(document).detailsBlocks) {
    if (indexed.kind !== "secretbox") continue;
    const block = enrichDetailsBlock(document, indexed);
    if (!block.isEncrypted) blocks.push(block);
  }
  if (blocks.length === 0) {
    return true;
  }

  // Prompt for password once
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
      const lockedBody = ["", "`🔒 ENCRYPTED — use /unlock to decrypt`", "", `<!--lotion-lock:${blob}-->`].join("\n");

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
 * secretboxes.  The save is blocked and the user is warned.
 *
 * Implementation: overrides the built-in `workbench.action.files.save`
 * command.  For markdown documents with unlocked boxes it shows a
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
        // Lock every unlocked secretbox in the document, then save
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

    // No unlocked secretboxes, proceed with save
    await hostEditor.saveActiveDocument();
  });
}
