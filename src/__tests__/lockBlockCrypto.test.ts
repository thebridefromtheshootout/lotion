import { encrypt, decrypt } from "../blocks/lockBlock";
import * as crypto from "crypto";

// Re-create the v1 (legacy) blob format here so we can verify decryption
// still accepts it. Mirrors the original constants from lockBlock.
const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;
const PBKDF2_ITERATIONS_V1 = 100_000;

function v1Encrypt(plaintext: string, password: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS_V1, KEY_LEN, "sha512");
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [salt.toString("base64"), iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

describe("lockBlock crypto round-trip", () => {
  it("encrypts then decrypts plain ASCII text", () => {
    const blob = encrypt("hello world", "correct horse");
    expect(decrypt(blob, "correct horse")).toBe("hello world");
  });

  it("encrypts then decrypts UTF-8 text", () => {
    const blob = encrypt("héllo 🌍", "pâsswórd");
    expect(decrypt(blob, "pâsswórd")).toBe("héllo 🌍");
  });

  it("returns undefined when the password is wrong", () => {
    const blob = encrypt("secret", "right");
    expect(decrypt(blob, "wrong")).toBeUndefined();
  });

  it("returns undefined for a blob with the wrong number of segments", () => {
    expect(decrypt("a.b.c", "anything")).toBeUndefined();
    expect(decrypt("a.b.c.d.e.f", "anything")).toBeUndefined();
  });

  it("returns undefined when the auth tag is corrupted", () => {
    const blob = encrypt("secret", "p");
    const parts = blob.split(".");
    // mutate the tag (segment index 3 in the v2 layout)
    parts[3] = Buffer.from("0000000000000000").toString("base64");
    expect(decrypt(parts.join("."), "p")).toBeUndefined();
  });

  it("emits the v2-prefixed blob format for new encryptions", () => {
    const blob = encrypt("payload", "pw");
    const parts = blob.split(".");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("v2");
  });

  it("decrypts legacy v1 (4-segment) blobs at the original 100k iteration count", () => {
    const blob = v1Encrypt("legacy data", "old-password");
    expect(blob.split(".")).toHaveLength(4); // v1 shape sanity check
    expect(decrypt(blob, "old-password")).toBe("legacy data");
  });

  it("rejects v1 blobs decrypted with the wrong password", () => {
    const blob = v1Encrypt("legacy data", "old-password");
    expect(decrypt(blob, "different")).toBeUndefined();
  });
});
