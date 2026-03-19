// AES-256-GCM envelope encryption for signing keys at rest.
// Uses Web Crypto API only (Cloudflare Workers compatible).

const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

function base64Encode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

function buildSalt(orgId: string): Uint8Array {
  const encoder = new TextEncoder();
  // Deterministic salt derived from org ID so the same secret + org always
  // produces the same derived key (no need to store the salt separately).
  return encoder.encode(`kindlm:signing-key:${orgId}`);
}

/**
 * Encrypts plaintext with AES-256-GCM using a key derived from `secret` and `orgId`.
 * Returns base64(iv || ciphertext) — the GCM tag is appended to the ciphertext by Web Crypto.
 */
export async function encryptWithSecret(
  plaintext: string,
  secret: string,
  orgId: string,
): Promise<string> {
  const salt = buildSalt(orgId);
  const key = await deriveKey(secret, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  // Concatenate iv + ciphertext (which includes the GCM auth tag)
  const combined = new Uint8Array(IV_LENGTH + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), IV_LENGTH);

  return base64Encode(combined.buffer);
}

/**
 * Decrypts a value produced by `encryptWithSecret`.
 * Splits iv from ciphertext, derives the same key, and decrypts.
 */
export async function decryptWithSecret(
  encrypted: string,
  secret: string,
  orgId: string,
): Promise<string> {
  const combined = base64Decode(encrypted);
  if (combined.byteLength <= IV_LENGTH) {
    throw new Error("Invalid encrypted data: too short");
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const salt = buildSalt(orgId);
  const key = await deriveKey(secret, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
