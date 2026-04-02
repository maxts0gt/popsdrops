/**
 * AES-256-GCM encryption for OAuth tokens.
 *
 * Tokens are encrypted before storage in Supabase and decrypted only
 * server-side in Route Handlers / Server Actions. The encryption key
 * lives in SOCIAL_TOKEN_ENCRYPTION_KEY (32-byte hex, i.e. 64 hex chars).
 *
 * Format: base64(iv + authTag + ciphertext)
 *   - iv: 12 bytes
 *   - authTag: 16 bytes
 *   - ciphertext: variable
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt a plaintext token for database storage. */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // iv (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/** Decrypt a token retrieved from the database. */
export function decryptToken(encoded: string): string {
  const key = getKey();
  const combined = Buffer.from(encoded, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
