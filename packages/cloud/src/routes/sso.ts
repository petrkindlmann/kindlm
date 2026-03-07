import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { requirePlan } from "../middleware/plan-gate.js";
import { auditLog } from "./audit-helper.js";

export const ssoRoutes = new Hono<AppEnv>();

const SP_ENTITY_ID = "https://api.kindlm.com/auth/saml";
const ACS_URL = "https://api.kindlm.com/auth/saml/callback";

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

// POST /callback — Receive SAML assertion (public, no auth)
// DISABLED: Cryptographic signature verification requires a SAML library.
// Without it, any attacker can forge assertions and bypass authentication.
// Re-enable only after integrating proper XML signature verification.
ssoRoutes.post("/callback", (c) => {
  return c.json({ error: "SAML SSO is not yet available. Contact support@kindlm.com." }, 501);
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
