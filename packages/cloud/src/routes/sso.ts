import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { hashToken } from "../middleware/auth.js";
import { requirePlan } from "../middleware/plan-gate.js";
import { auditLog } from "./audit-helper.js";
import { encryptWithSecret } from "../crypto/envelope.js";
import {
  SP_ENTITY_ID,
  ACS_URL,
  AUTH_CODE_TTL_SECONDS,
  extractNameID,
  extractAttribute,
  extractIssuer,
  extractAssertionId,
  checkConditions,
  base64ToBytes,
  ssoGithubId,
  escapeHtml,
  verifySamlSignature,
  getAllowedOrigins,
} from "../saml/helpers.js";

// Re-export helpers so existing test imports from "./sso.js" still work
export {
  verifySamlSignature,
  extractNameID,
  extractAttribute,
  extractIssuer,
  extractAssertionId,
  checkConditions,
  base64ToBytes,
  canonicalizeSignedInfo,
  ssoGithubId,
} from "../saml/helpers.js";

export const ssoRoutes = new Hono<AppEnv>();

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
