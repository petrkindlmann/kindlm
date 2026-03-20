import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { hashToken } from "../middleware/auth.js";
import { requirePlan } from "../middleware/plan-gate.js";
import { auditLog } from "./audit-helper.js";
import { encryptWithSecret } from "../crypto/envelope.js";

export const ssoRoutes = new Hono<AppEnv>();

const SP_ENTITY_ID = "https://api.kindlm.com/auth/saml";
const ACS_URL = "https://api.kindlm.com/auth/saml/callback";
const AUTH_CODE_TTL_SECONDS = 30;

// ---------------------------------------------------------------------------
// XML parsing helpers — lightweight string-based extraction for SAML responses
// ---------------------------------------------------------------------------

function extractNameID(xml: string): string | null {
  const match = xml.match(/<(?:saml[2p]?:)?NameID[^>]*>([^<]+)</);
  return match?.[1]?.trim() ?? null;
}

function extractAttribute(xml: string, name: string): string | null {
  const attrRegex = new RegExp(
    `<(?:saml[2p]?:)?Attribute[^>]*Name=["']${escapeRegex(name)}["'][^>]*>[\\s\\S]*?<(?:saml[2p]?:)?AttributeValue[^>]*>([^<]+)`,
    "i",
  );
  const match = xml.match(attrRegex);
  return match?.[1]?.trim() ?? null;
}

function extractIssuer(xml: string): string | null {
  const match = xml.match(/<(?:saml[2p]?:)?Issuer[^>]*>([^<]+)</);
  return match?.[1]?.trim() ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ssoGithubId(email: string): Promise<number> {
  const data = new TextEncoder().encode(`sso:${email}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const view = new DataView(hash);
  // Use first 6 bytes as negative int (safe in JS, avoids collision with real GitHub IDs)
  return -(view.getUint32(0) * 65536 + view.getUint16(4));
}

function extractAssertionId(xml: string): string | null {
  const match = xml.match(/<(?:saml[2p]?:)?Assertion[^>]*\sID=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Timing condition checks
// ---------------------------------------------------------------------------

function checkConditions(xml: string): { valid: boolean; error?: string } {
  const conditionsMatch = xml.match(
    /<(?:saml[2p]?:)?Conditions([^>]*)>/,
  );
  if (!conditionsMatch) {
    // No conditions element — accept (some IDPs omit it)
    return { valid: true };
  }

  const attrs = conditionsMatch[1] ?? "";
  const now = Date.now();

  const notBeforeMatch = attrs.match(/NotBefore=["']([^"']+)["']/);
  if (notBeforeMatch?.[1]) {
    const notBefore = new Date(notBeforeMatch[1]).getTime();
    // Allow 60s clock skew
    if (now < notBefore - 60_000) {
      return { valid: false, error: "Assertion is not yet valid (NotBefore)" };
    }
  }

  const notOnOrAfterMatch = attrs.match(/NotOnOrAfter=["']([^"']+)["']/);
  if (notOnOrAfterMatch?.[1]) {
    const notOnOrAfter = new Date(notOnOrAfterMatch[1]).getTime();
    // Allow 60s clock skew
    if (now >= notOnOrAfter + 60_000) {
      return { valid: false, error: "Assertion has expired (NotOnOrAfter)" };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// XML Signature verification using Web Crypto API
// ---------------------------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, "");
  const bytes = base64ToBytes(b64);
  // Copy to a plain ArrayBuffer to satisfy Workers types
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

interface AlgorithmConfig {
  importParams: { name: string; hash: string };
  verifyParams: { name: string };
}

function getAlgorithmConfig(xmlAlg: string): AlgorithmConfig {
  if (xmlAlg.includes("rsa-sha1") || xmlAlg.includes("sha1")) {
    return {
      importParams: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" },
      verifyParams: { name: "RSASSA-PKCS1-v1_5" },
    };
  }
  // Default: RSA-SHA256
  return {
    importParams: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    verifyParams: { name: "RSASSA-PKCS1-v1_5" },
  };
}

function canonicalizeSignedInfo(signedInfo: string, fullXml: string): string {
  let canonical = signedInfo;
  // If the ds namespace is inherited from a parent, add it to SignedInfo for C14N
  if (!canonical.includes("xmlns:ds=") && fullXml.includes("xmlns:ds=")) {
    const nsMatch = fullXml.match(/xmlns:ds=["'][^"']+["']/);
    if (nsMatch) {
      canonical = canonical.replace(
        /<(ds:)?SignedInfo/,
        `<ds:SignedInfo ${nsMatch[0]}`,
      );
    }
  }
  return canonical;
}

function getDigestAlgorithm(digestMethodUri: string): string {
  if (digestMethodUri.includes("sha1")) return "SHA-1";
  if (digestMethodUri.includes("sha512")) return "SHA-512";
  // Default to SHA-256
  return "SHA-256";
}

function extractReferencedElement(xml: string, uri: string): string | null {
  if (!uri || uri === "") {
    // Empty URI means the whole document (minus the Signature element)
    return xml.replace(/<(?:ds:)?Signature[\s\S]*?<\/(?:ds:)?Signature>/, "");
  }
  // URI is typically "#id" — find the element with that ID
  const id = uri.startsWith("#") ? uri.slice(1) : uri;
  const idRegex = new RegExp(
    `<([^>]*\\sID=["']${escapeRegex(id)}["'][^>]*)>[\\s\\S]*?<\\/[^>]+>`,
    "i",
  );
  const match = xml.match(idRegex);
  return match?.[0] ?? null;
}

export async function verifySamlSignature(
  xml: string,
  certificatePem: string,
): Promise<boolean> {
  // Extract SignatureValue
  const sigValueMatch = xml.match(
    /<(?:ds:)?SignatureValue[^>]*>([\s\S]*?)<\/(?:ds:)?SignatureValue>/,
  );
  if (!sigValueMatch?.[1]) return false;
  const signatureBytes = base64ToBytes(sigValueMatch[1].replace(/\s/g, ""));

  // Extract SignedInfo
  const signedInfoMatch = xml.match(
    /<(?:ds:)?SignedInfo[^>]*>[\s\S]*?<\/(?:ds:)?SignedInfo>/,
  );
  if (!signedInfoMatch?.[0]) return false;
  const signedInfoXml = signedInfoMatch[0];

  // Verify DigestValue before checking the signature over SignedInfo.
  // This ensures the referenced assertion body hasn't been tampered with.
  const refMatch = signedInfoXml.match(
    /<(?:ds:)?Reference[^>]*(?:URI=["']([^"']*)["'])?[^>]*>[\s\S]*?<\/(?:ds:)?Reference>/,
  );
  if (refMatch) {
    const refUri = refMatch[1] ?? "";

    // Extract DigestMethod algorithm
    const digestMethodMatch = refMatch[0].match(
      /<(?:ds:)?DigestMethod[^>]*Algorithm=["']([^"']+)["']/,
    );
    const digestAlg = digestMethodMatch?.[1]
      ? getDigestAlgorithm(digestMethodMatch[1])
      : "SHA-256";

    // Extract the claimed DigestValue
    const digestValueMatch = refMatch[0].match(
      /<(?:ds:)?DigestValue[^>]*>([\s\S]*?)<\/(?:ds:)?DigestValue>/,
    );
    if (!digestValueMatch?.[1]) return false;
    const claimedDigest = digestValueMatch[1].replace(/\s/g, "");

    // Hash the referenced element and compare
    const referencedElement = extractReferencedElement(xml, refUri);
    if (!referencedElement) return false;

    const refBytes = new TextEncoder().encode(referencedElement);
    const digestBuf = await crypto.subtle.digest(digestAlg, refBytes);
    const computedDigest = btoa(
      String.fromCharCode(...new Uint8Array(digestBuf)),
    );

    if (computedDigest !== claimedDigest) return false;
  }

  // Determine algorithm
  const algMatch = xml.match(
    /<(?:ds:)?SignatureMethod[^>]*Algorithm=["']([^"']+)["']/,
  );
  const algorithm = algMatch?.[1] ?? "";
  const algConfig = getAlgorithmConfig(algorithm);

  // Canonicalize SignedInfo
  const signedInfo = canonicalizeSignedInfo(signedInfoXml, xml);

  // Import the IDP certificate
  let certDer: ArrayBuffer;
  try {
    certDer = pemToDer(certificatePem);
  } catch {
    return false;
  }
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "spki",
      certDer,
      algConfig.importParams,
      false,
      ["verify"],
    );
  } catch {
    return false;
  }

  // Verify signature over SignedInfo
  const signedInfoBytes = new TextEncoder().encode(signedInfo);
  try {
    return await crypto.subtle.verify(
      algConfig.verifyParams,
      cryptoKey,
      signatureBytes,
      signedInfoBytes,
    );
  } catch {
    return false;
  }
}

// Exported for testing
export {
  extractNameID,
  extractAttribute,
  extractIssuer,
  extractAssertionId,
  checkConditions,
  base64ToBytes,
  canonicalizeSignedInfo,
  ssoGithubId,
};

// ---------------------------------------------------------------------------
// Dashboard redirect helpers
// ---------------------------------------------------------------------------

function getAllowedOrigins(env: AppEnv["Bindings"]): string[] {
  const origins = ["https://cloud.kindlm.com"];
  if (env.ENVIRONMENT !== "production") {
    origins.push("http://localhost:3001");
  }
  return origins;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /metadata — Return SP metadata XML (public, no auth)
ssoRoutes.get("/metadata", (c) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${SP_ENTITY_ID}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${ACS_URL}"
      index="0"
      isDefault="true" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

  return c.body(xml, 200, { "Content-Type": "application/xml" });
});

// POST /callback — Receive SAML assertion from IDP (public, no auth)
ssoRoutes.post("/callback", async (c) => {
  // Parse the form body
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Invalid form data" }, 400);
  }

  const samlResponseB64 = formData.get("SAMLResponse");
  if (!samlResponseB64 || typeof samlResponseB64 !== "string") {
    return c.json({ error: "Missing SAMLResponse field" }, 400);
  }

  // Decode base64 to XML
  let xml: string;
  try {
    xml = new TextDecoder().decode(base64ToBytes(samlResponseB64));
  } catch {
    return c.json({ error: "Invalid base64 in SAMLResponse" }, 400);
  }

  // Extract the IDP issuer to find the matching SAML config
  const issuer = extractIssuer(xml);
  if (!issuer) {
    return c.json({ error: "No Issuer found in SAML response" }, 400);
  }

  const queries = getQueries(c.env.DB);

  // Find the SAML config that matches this IDP entity ID
  const enabledConfigs = await queries.getEnabledSamlConfigs();
  const samlConfig = enabledConfigs.find((cfg) => cfg.idpEntityId === issuer);
  if (!samlConfig) {
    return c.json({ error: "No SAML configuration found for this identity provider" }, 404);
  }

  // Verify XML signature against the stored IDP certificate
  const signatureValid = await verifySamlSignature(xml, samlConfig.idpCertificate);
  if (!signatureValid) {
    return c.json({ error: "Invalid SAML signature" }, 403);
  }

  // Check timing conditions (NotBefore / NotOnOrAfter)
  const conditions = checkConditions(xml);
  if (!conditions.valid) {
    return c.json({ error: conditions.error ?? "Assertion conditions not met" }, 400);
  }

  // Assertion replay protection: reject if this assertion ID was already used
  const assertionId = extractAssertionId(xml);
  if (assertionId) {
    const existing = await c.env.DB.prepare(
      "SELECT assertion_id FROM saml_assertions WHERE assertion_id = ?",
    )
      .bind(assertionId)
      .first();
    if (existing) {
      return c.json({ error: "SAML assertion already used (replay detected)" }, 400);
    }
    // Store the assertion ID with a 24h TTL for cleanup
    const assertionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      "INSERT INTO saml_assertions (assertion_id, org_id, expires_at) VALUES (?, ?, ?)",
    )
      .bind(assertionId, samlConfig.orgId, assertionExpiresAt)
      .run();
  }

  // Extract user attributes
  const nameId = extractNameID(xml);
  const email =
    nameId ??
    extractAttribute(xml, "email") ??
    extractAttribute(
      xml,
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    );

  if (!email) {
    return c.json({ error: "No email found in SAML assertion" }, 400);
  }

  const displayName =
    extractAttribute(xml, "displayName") ??
    extractAttribute(
      xml,
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    );

  // Find or create user by email
  let user = await queries.getUserByEmail(email);
  if (user) {
    // Update display name if present
    if (displayName) {
      await queries.updateUser(user.id, { githubLogin: displayName });
    }
  } else {
    // Use a cryptographic hash of the email as a unique pseudo-githubId for SSO-only users,
    // since the users table has UNIQUE(github_id) and 0 would collide for all SSO users.
    const pseudoGithubId = await ssoGithubId(email);
    user = await queries.createUser(pseudoGithubId, displayName ?? email, email, null);
    // Add user to the SSO org
    await queries.addOrgMember(samlConfig.orgId, user.id, "member");
  }

  // Ensure user is a member of the SSO org
  const membership = await queries.getOrgMember(samlConfig.orgId, user.id);
  if (!membership) {
    await queries.addOrgMember(samlConfig.orgId, user.id, "member");
  }

  // Generate API token with 24h expiry for SSO sessions
  const tokenBytes = new Uint8Array(16);
  crypto.getRandomValues(tokenBytes);
  const hex = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `klm_${hex}`;
  const tokenHash = await hashToken(plaintext);
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await queries.createToken(
    samlConfig.orgId,
    `sso-${new Date().toISOString().slice(0, 10)}`,
    tokenHash,
    "full",
    null,
    tokenExpiresAt,
    user.id,
  );

  // Check RelayState for dashboard redirect
  const relayState = formData.get("RelayState");
  if (relayState && typeof relayState === "string") {
    try {
      const parsed = new URL(relayState);
      const allowed = getAllowedOrigins(c.env);
      if (allowed.includes(parsed.origin)) {
        // Store short-lived auth code for secure code exchange
        const codeBytes = new Uint8Array(32);
        crypto.getRandomValues(codeBytes);
        const authCode = Array.from(codeBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const expiresAt = new Date(
          Date.now() + AUTH_CODE_TTL_SECONDS * 1000,
        ).toISOString();

        // Encrypt the token before storage
        const encryptedToken = await encryptWithSecret(plaintext, c.env.GITHUB_CLIENT_SECRET, "auth_codes");
        await c.env.DB.prepare(
          "INSERT INTO auth_codes (code, token, expires_at) VALUES (?, ?, ?)",
        )
          .bind(authCode, encryptedToken, expiresAt)
          .run();

        const redirectUrl = new URL(relayState);
        redirectUrl.searchParams.set("code", authCode);
        return c.redirect(redirectUrl.toString());
      }
    } catch {
      // Invalid URL in RelayState — fall through to HTML response
    }
  }

  // No valid relay state — return HTML page with token for copy-paste (CLI flow)
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KindLM — Authenticated via SSO</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1c1917; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #57534e; line-height: 1.6; }
    .token-box { background: #1c1917; color: #d6d3d1; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 14px; word-break: break-all; margin: 24px 0; cursor: pointer; position: relative; }
    .token-box:hover { background: #292524; }
    .hint { font-size: 13px; color: #a8a29e; }
    .cmd { background: #f5f5f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; }
    .copied { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #4ade80; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Authenticated as ${escapeHtml(displayName ?? email)}</h1>
  <p>Copy this token and paste it into your terminal:</p>
  <div class="token-box" id="token" onclick="copyToken()">
    ${plaintext}
    <span class="copied" id="copied" style="display:none">Copied!</span>
  </div>
  <p class="hint">Or run: <span class="cmd">kindlm login --token ${plaintext}</span></p>
  <p class="hint">You can close this tab after copying the token.</p>
  <script>
    function copyToken() {
      navigator.clipboard.writeText('${plaintext}');
      document.getElementById('copied').style.display = 'inline';
      setTimeout(function() { document.getElementById('copied').style.display = 'none'; }, 2000);
    }
  </script>
</body>
</html>`;

  return c.html(html);
});

// GET /config — Get SAML config (enterprise only, requires auth)
ssoRoutes.get("/config", requirePlan("enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const config = await queries.getSamlConfig(auth.org.id);
  if (!config) {
    return c.json({ configured: false });
  }

  return c.json({
    configured: true,
    idpEntityId: config.idpEntityId,
    idpSsoUrl: config.idpSsoUrl,
    spEntityId: config.spEntityId,
    enabled: config.enabled,
    createdAt: config.createdAt,
  });
});

// PUT /config — Set SAML config (enterprise only, requires auth)
ssoRoutes.put("/config", requirePlan("enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const body = await c.req.json<{
    idpEntityId?: string;
    idpSsoUrl?: string;
    idpCertificate?: string;
    enabled?: boolean;
  }>();

  if (!body.idpEntityId || !body.idpSsoUrl || !body.idpCertificate) {
    return c.json(
      { error: "idpEntityId, idpSsoUrl, and idpCertificate are required" },
      400,
    );
  }

  if (!body.idpSsoUrl.startsWith("https://")) {
    return c.json({ error: "idpSsoUrl must be HTTPS" }, 400);
  }

  const config = await queries.upsertSamlConfig(auth.org.id, {
    idpEntityId: body.idpEntityId,
    idpSsoUrl: body.idpSsoUrl,
    idpCertificate: body.idpCertificate,
    spEntityId: SP_ENTITY_ID,
    enabled: body.enabled ?? false,
  });

  auditLog(c, "sso.configure", "saml_config", auth.org.id, {
    idpEntityId: config.idpEntityId,
    enabled: config.enabled,
  });

  return c.json({
    idpEntityId: config.idpEntityId,
    idpSsoUrl: config.idpSsoUrl,
    spEntityId: config.spEntityId,
    enabled: config.enabled,
    createdAt: config.createdAt,
  });
});
