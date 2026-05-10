// Cryptographically-strong identifier generators.
//
// Replaces ad-hoc `Math.random()`-based GUID/short-id generators that lived
// in feature modules. crypto.randomBytes is available in Node and in
// vscode's extension host, so callers don't need to fall back to anything.

import * as crypto from "crypto";

/**
 * RFC 4122 v4 UUID. 36 chars, lower-case hex, hyphenated.
 * Uses crypto.randomUUID() when available (Node 14.17+).
 */
export function guid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for very old Node versions.
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Short opaque token suitable for in-document marker IDs (e.g. comments).
 * Returns 14 lowercase alphanumeric chars from a 12-byte random source.
 */
export function shortId(): string {
  return crypto.randomBytes(12).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 14).toLowerCase();
}
