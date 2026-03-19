import { describe, it, expect } from "vitest";
import { encryptWithSecret, decryptWithSecret } from "./envelope.js";

describe("envelope encryption", () => {
  const secret = "test-signing-key-secret-value";
  const orgId = "org-123";

  it("round-trips plaintext through encrypt then decrypt", async () => {
    const plaintext = "MIGHAgEAMBMGByqGZSomeBase64PrivateKeyData==";
    const encrypted = await encryptWithSecret(plaintext, secret, orgId);
    const decrypted = await decryptWithSecret(encrypted, secret, orgId);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const plaintext = "same-input-different-output";
    const a = await encryptWithSecret(plaintext, secret, orgId);
    const b = await encryptWithSecret(plaintext, secret, orgId);
    expect(a).not.toBe(b);
    // Both still decrypt to the same value
    expect(await decryptWithSecret(a, secret, orgId)).toBe(plaintext);
    expect(await decryptWithSecret(b, secret, orgId)).toBe(plaintext);
  });

  it("fails to decrypt with wrong secret", async () => {
    const plaintext = "sensitive-key-data";
    const encrypted = await encryptWithSecret(plaintext, secret, orgId);
    await expect(
      decryptWithSecret(encrypted, "wrong-secret", orgId),
    ).rejects.toThrow();
  });

  it("fails to decrypt with wrong orgId", async () => {
    const plaintext = "sensitive-key-data";
    const encrypted = await encryptWithSecret(plaintext, secret, orgId);
    await expect(
      decryptWithSecret(encrypted, secret, "org-other"),
    ).rejects.toThrow();
  });

  it("rejects invalid encrypted data (too short)", async () => {
    await expect(
      decryptWithSecret(btoa("short"), secret, orgId),
    ).rejects.toThrow("Invalid encrypted data: too short");
  });

  it("handles empty plaintext", async () => {
    const encrypted = await encryptWithSecret("", secret, orgId);
    const decrypted = await decryptWithSecret(encrypted, secret, orgId);
    expect(decrypted).toBe("");
  });

  it("handles long plaintext", async () => {
    const plaintext = "A".repeat(10_000);
    const encrypted = await encryptWithSecret(plaintext, secret, orgId);
    const decrypted = await decryptWithSecret(encrypted, secret, orgId);
    expect(decrypted).toBe(plaintext);
  });
});
