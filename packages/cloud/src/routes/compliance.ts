import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { requirePlan } from "../middleware/plan-gate.js";
import { auditLog } from "./audit-helper.js";
import { encryptWithSecret, decryptWithSecret } from "../crypto/envelope.js";

export const complianceRoutes = new Hono<AppEnv>();

async function exportKeyBase64(key: CryptoKey, format: "spki" | "pkcs8"): Promise<string> {
  const exported = await crypto.subtle.exportKey(format, key) as ArrayBuffer;
  const bytes = new Uint8Array(exported);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getOrCreateKeyPair(
  orgId: string,
  queries: ReturnType<typeof getQueries>,
  signingKeySecret: string,
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; publicKeyBase64: string }> {
  const existing = await queries.getSigningKey(orgId);

  if (existing) {
    const publicKey = await crypto.subtle.importKey(
      "spki",
      base64ToBuffer(existing.publicKey),
      { name: "Ed25519" },
      true,
      ["verify"],
    );
    // Decrypt the private key before importing
    const privateKeyB64 = await decryptWithSecret(existing.privateKeyEnc, signingKeySecret, orgId);
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      base64ToBuffer(privateKeyB64),
      { name: "Ed25519" },
      false,
      ["sign"],
    );
    return { publicKey, privateKey, publicKeyBase64: existing.publicKey };
  }

  // Generate new key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;

  const publicKeyBase64 = await exportKeyBase64(keyPair.publicKey, "spki");
  const privateKeyBase64 = await exportKeyBase64(keyPair.privateKey, "pkcs8");

  // Encrypt the private key before storing
  const privateKeyEnc = await encryptWithSecret(privateKeyBase64, signingKeySecret, orgId);
  await queries.createSigningKey(orgId, publicKeyBase64, privateKeyEnc);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBase64,
  };
}

// POST /sign — Sign compliance report content (enterprise only)
complianceRoutes.post("/sign", requirePlan("enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const body = await c.req.json<{ content?: string }>();
  if (!body.content || body.content.trim().length === 0) {
    return c.json({ error: "content is required" }, 400);
  }

  const signingKeySecret = c.env.SIGNING_KEY_SECRET;
  if (!signingKeySecret || signingKeySecret.length < 32) {
    return c.json({ error: "SIGNING_KEY_SECRET not configured or too short" }, 500);
  }

  const { privateKey, publicKeyBase64 } = await getOrCreateKeyPair(auth.org.id, queries, signingKeySecret);

  const encoder = new TextEncoder();
  const data = encoder.encode(body.content);
  const signatureBuffer = await crypto.subtle.sign("Ed25519", privateKey, data);
  const signatureBytes = new Uint8Array(signatureBuffer);
  let signatureBinary = "";
  for (const byte of signatureBytes) {
    signatureBinary += String.fromCharCode(byte);
  }
  const signature = btoa(signatureBinary);

  auditLog(c, "compliance.sign", "compliance", null, { contentLength: body.content.length });

  return c.json({
    signature,
    publicKey: publicKeyBase64,
    algorithm: "Ed25519",
    signedAt: new Date().toISOString(),
  });
});

// POST /verify — Verify a signature against the org's public key
complianceRoutes.post("/verify", requirePlan("enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const body = await c.req.json<{ content?: string; signature?: string }>();
  if (!body.content || !body.signature) {
    return c.json({ error: "content and signature are required" }, 400);
  }

  const signingKey = await queries.getSigningKey(auth.org.id);
  if (!signingKey) {
    return c.json({ error: "No signing key found. Sign a report first." }, 404);
  }

  const publicKey = await crypto.subtle.importKey(
    "spki",
    base64ToBuffer(signingKey.publicKey),
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(body.content);
  const signatureBuffer = base64ToBuffer(body.signature);

  const valid = await crypto.subtle.verify("Ed25519", publicKey, signatureBuffer, data);

  return c.json({ valid, algorithm: "Ed25519" });
});

// GET /public-key — Return org's public key
complianceRoutes.get("/public-key", requirePlan("enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const signingKey = await queries.getSigningKey(auth.org.id);
  if (!signingKey) {
    return c.json({ error: "No signing key found. Sign a report first." }, 404);
  }

  return c.json({
    publicKey: signingKey.publicKey,
    algorithm: signingKey.algorithm,
    createdAt: signingKey.createdAt,
  });
});
