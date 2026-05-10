import * as crypto from "crypto";

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
const PBKDF2_ITERATIONS_V1 = 100_000;
const PBKDF2_ITERATIONS_V2 = 600_000;
const PBKDF2_DIGEST = "sha512";
const BLOB_VERSION_V2 = "v2";

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
