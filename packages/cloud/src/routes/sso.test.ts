import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Plan, SamlConfig } from "../types.js";
import {
  ssoRoutes,
  verifySamlSignature,
  extractNameID,
  extractAttribute,
  extractIssuer,
  checkConditions,
} from "./sso.js";
import { testEnv, testExecutionCtx, createMockD1 } from "../test-helpers.js";

// ---------------------------------------------------------------------------
// RSA key pair + SAML response builder for realistic signature testing.
// We generate a real RSA key pair once and use it for all signing tests.
// ---------------------------------------------------------------------------

let testKeyPair: CryptoKeyPair;
let testCertPem: string;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

function wrapPem(b64: string, label: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) {
    lines.push(b64.slice(i, i + 64));
  }
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

async function generateTestKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  certPem: string;
}> {
  const result = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );

  // Workers types return CryptoKey | CryptoKeyPair — cast since we know it's a pair
  const keyPair = result as CryptoKeyPair;

  // Export the public key as SPKI (this is what verifySamlSignature imports)
  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey) as ArrayBuffer;
  const b64 = bytesToBase64(new Uint8Array(spki));
  const pem = wrapPem(b64, "PUBLIC KEY");

  return { keyPair, certPem: pem };
}

interface SamlResponseOptions {
  issuer?: string;
  nameId?: string;
  attributes?: Record<string, string>;
  notBefore?: string;
  notOnOrAfter?: string;
  includeConditions?: boolean;
  // If false, produce an unsigned response
  sign?: boolean;
}

async function buildSamlResponse(opts: SamlResponseOptions = {}): Promise<string> {
  const issuer = opts.issuer ?? "https://idp.example.com";
  const nameId = opts.nameId ?? "user@example.com";
  const shouldSign = opts.sign !== false;
  const includeConditions = opts.includeConditions !== false;

  let attributeXml = "";
  if (opts.attributes) {
    const attrStatements: string[] = [];
    for (const [name, value] of Object.entries(opts.attributes)) {
      attrStatements.push(
        `<saml:Attribute Name="${name}"><saml:AttributeValue>${value}</saml:AttributeValue></saml:Attribute>`,
      );
    }
    attributeXml = `<saml:AttributeStatement>${attrStatements.join("")}</saml:AttributeStatement>`;
  }

  let conditionsXml = "";
  if (includeConditions) {
    const nb = opts.notBefore ?? new Date(Date.now() - 300_000).toISOString();
    const noa = opts.notOnOrAfter ?? new Date(Date.now() + 300_000).toISOString();
    conditionsXml = `<saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}"></saml:Conditions>`;
  }

  // Build the assertion body (without signature)
  const assertionBody = `<saml:Issuer>${issuer}</saml:Issuer>${conditionsXml}<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID></saml:Subject>${attributeXml}`;

  if (!shouldSign) {
    return `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}</saml:Assertion></samlp:Response>`;
  }

  // Compute a real DigestValue over the full document (minus signature, since it doesn't exist yet).
  // The Reference URI="" means the whole document with the Signature element removed.
  const unsignedXml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}</saml:Assertion></samlp:Response>`;
  const digestBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(unsignedXml));
  const digestB64 = bytesToBase64(new Uint8Array(digestBuf));

  // Build the SignedInfo with the real digest
  const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI=""><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${digestB64}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

  // Sign the SignedInfo with our test private key
  const signedInfoBytes = new TextEncoder().encode(signedInfo);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    testKeyPair.privateKey,
    signedInfoBytes,
  );
  const sigB64 = bytesToBase64(new Uint8Array(signature));

  // Build the full Signature element
  const signatureXml = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<ds:SignatureValue>${sigB64}</ds:SignatureValue></ds:Signature>`;

  return `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}${signatureXml}</saml:Assertion></samlp:Response>`;
}

function samlResponseToBase64(xml: string): string {
  return bytesToBase64(new TextEncoder().encode(xml));
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockGetSamlConfig = vi.fn().mockResolvedValue(null);
const mockUpsertSamlConfig = vi.fn().mockResolvedValue({
  orgId: "org-1",
  idpEntityId: "https://idp.example.com",
  idpSsoUrl: "https://idp.example.com/sso",
  spEntityId: "https://api.kindlm.com/auth/saml",
  enabled: true,
  createdAt: "2026-01-01T00:00:00Z",
});
const mockLogAudit = vi.fn().mockResolvedValue(undefined);
const mockGetEnabledSamlConfigs = vi.fn().mockResolvedValue([]);
const mockGetUserByEmail = vi.fn().mockResolvedValue(null);
const mockCreateUser = vi.fn().mockImplementation(
  (_githubId: number, githubLogin: string, email: string | null, _avatarUrl: string | null) => ({
    id: "user-sso-1",
    githubId: 0,
    githubLogin: githubLogin,
    email,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  }),
);
const mockUpdateUser = vi.fn().mockResolvedValue(undefined);
const mockAddOrgMember = vi.fn().mockResolvedValue({
  orgId: "org-1",
  userId: "user-sso-1",
  role: "member",
  createdAt: new Date().toISOString(),
});
const mockGetOrgMember = vi.fn().mockResolvedValue(null);
const mockCreateToken = vi.fn().mockResolvedValue({
  id: "tok-sso-1",
  orgId: "org-1",
  userId: "user-sso-1",
  name: "sso-login",
  tokenHash: "hash",
  scope: "full",
  projectId: null,
  expiresAt: null,
  lastUsed: null,
  createdAt: new Date().toISOString(),
  revokedAt: null,
});

vi.mock("../db/queries.js", () => ({
  getQueries: () => ({
    getSamlConfig: mockGetSamlConfig,
    upsertSamlConfig: mockUpsertSamlConfig,
    getEnabledSamlConfigs: mockGetEnabledSamlConfigs,
    getUserByEmail: mockGetUserByEmail,
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
    addOrgMember: mockAddOrgMember,
    getOrgMember: mockGetOrgMember,
    createToken: mockCreateToken,
    logAudit: mockLogAudit,
  }),
}));

vi.mock("../middleware/auth.js", () => ({
  hashToken: vi.fn().mockResolvedValue("mocked-hash"),
}));

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createMockApp(plan: Plan = "enterprise") {
  const app = new Hono<AppEnv>();
  // Public routes don't need auth middleware
  app.route("/auth/saml", ssoRoutes);
  // Authenticated routes need auth context
  const authedApp = new Hono<AppEnv>();
  authedApp.use("*", async (c, next) => {
    c.set("auth", {
      org: { id: "org-1", name: "Test Org", plan, createdAt: "", updatedAt: "" },
      token: { id: "tok-1", orgId: "org-1", userId: null, name: "test", tokenHash: "", scope: "full" as const, projectId: null, expiresAt: null, lastUsed: null, createdAt: "", revokedAt: null },
      user: null,
    });
    await next();
  });
  authedApp.route("/v1/sso", ssoRoutes);
  app.route("", authedApp);
  return app;
}

function req(app: Hono<AppEnv>, url: string, init?: RequestInit) {
  return app.request(url, init, testEnv, testExecutionCtx);
}

function makeFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const result = await generateTestKeyPair();
  testKeyPair = result.keyPair;
  testCertPem = result.certPem;
});

describe("SSO routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------- Metadata -------

  it("GET /auth/saml/metadata returns SP metadata XML", async () => {
    const app = createMockApp();
    const res = await req(app, "/auth/saml/metadata");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("EntityDescriptor");
    expect(body).toContain("kindlm.com");
  });

  // ------- Config endpoints (enterprise only) -------

  it("GET /v1/sso/config returns not configured when no config", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/sso/config");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { configured: boolean };
    expect(body.configured).toBe(false);
  });

  it("PUT /v1/sso/config rejects non-enterprise plans", async () => {
    const app = createMockApp("team");
    const res = await req(app, "/v1/sso/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: "MIICert...",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("PUT /v1/sso/config requires HTTPS for idpSsoUrl", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/sso/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "http://idp.example.com/sso",
        idpCertificate: "MIICert...",
      }),
    });
    expect(res.status).toBe(400);
  });

  // ------- SAML Callback -------

  describe("POST /auth/saml/callback", () => {
    it("rejects missing SAMLResponse field", async () => {
      const app = createMockApp();
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "other=value",
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Missing SAMLResponse field");
    });

    it("rejects invalid base64 in SAMLResponse", async () => {
      const app = createMockApp();
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: makeFormBody({ SAMLResponse: "!!!not-valid-base64!!!" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Invalid base64 in SAMLResponse");
    });

    it("rejects when no Issuer found in response", async () => {
      const app = createMockApp();
      const xml = "<samlp:Response><saml:Assertion></saml:Assertion></samlp:Response>";
      const b64 = samlResponseToBase64(xml);
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: makeFormBody({ SAMLResponse: b64 }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("No Issuer found in SAML response");
    });

    it("returns 404 when no SAML config matches the IDP issuer", async () => {
      mockGetEnabledSamlConfigs.mockResolvedValue([]);

      const app = createMockApp();
      const xml = await buildSamlResponse({ sign: false });
      const b64 = samlResponseToBase64(xml);
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: makeFormBody({ SAMLResponse: b64 }),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("No SAML configuration found");
    });

    it("returns 403 when signature is invalid", async () => {
      const samlConfig: SamlConfig = {
        orgId: "org-1",
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: testCertPem,
        spEntityId: "https://api.kindlm.com/auth/saml",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      mockGetEnabledSamlConfigs.mockResolvedValue([samlConfig]);

      const app = createMockApp();
      // Build an unsigned response (no signature element => verification fails)
      const xml = await buildSamlResponse({ sign: false });
      const b64 = samlResponseToBase64(xml);
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: makeFormBody({ SAMLResponse: b64 }),
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Invalid SAML signature");
    });

    it("returns 400 when assertion is expired (NotOnOrAfter)", async () => {
      const samlConfig: SamlConfig = {
        orgId: "org-1",
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: testCertPem,
        spEntityId: "https://api.kindlm.com/auth/saml",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      mockGetEnabledSamlConfigs.mockResolvedValue([samlConfig]);

      const app = createMockApp();
      const pastDate = new Date(Date.now() - 600_000).toISOString(); // 10 min ago
      const xml = await buildSamlResponse({
        notBefore: new Date(Date.now() - 900_000).toISOString(),
        notOnOrAfter: pastDate,
      });
      const b64 = samlResponseToBase64(xml);
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: makeFormBody({ SAMLResponse: b64 }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("expired");
    });

    it("returns 400 when assertion is not yet valid (NotBefore)", async () => {
      const samlConfig: SamlConfig = {
        orgId: "org-1",
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: testCertPem,
        spEntityId: "https://api.kindlm.com/auth/saml",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      mockGetEnabledSamlConfigs.mockResolvedValue([samlConfig]);

      const app = createMockApp();
      const futureDate = new Date(Date.now() + 600_000).toISOString(); // 10 min from now
      const xml = await buildSamlResponse({
        notBefore: futureDate,
        notOnOrAfter: new Date(Date.now() + 900_000).toISOString(),
      });
      const b64 = samlResponseToBase64(xml);
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: makeFormBody({ SAMLResponse: b64 }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("NotBefore");
    });

    it("creates new user and returns token on valid SAML response", async () => {
      const samlConfig: SamlConfig = {
        orgId: "org-1",
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: testCertPem,
        spEntityId: "https://api.kindlm.com/auth/saml",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      mockGetEnabledSamlConfigs.mockResolvedValue([samlConfig]);
      mockGetUserByEmail.mockResolvedValue(null);
      mockGetOrgMember.mockResolvedValue(null);

      const mockD1 = createMockD1();
      mockD1._configureResponse("INSERT INTO auth_codes", { changes: 1 });

      const app = createMockApp();
      const xml = await buildSamlResponse({
        nameId: "alice@example.com",
        attributes: { displayName: "Alice Smith" },
      });
      const b64 = samlResponseToBase64(xml);
      const env = { ...testEnv, DB: mockD1 as unknown as D1Database };
      const res = await app.request(
        "/auth/saml/callback",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: makeFormBody({ SAMLResponse: b64 }),
        },
        env,
        testExecutionCtx,
      );

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Authenticated");
      expect(body).toContain("klm_");

      // Verify user was created with a negative hash of the email as githubId
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.any(Number),
        "Alice Smith",
        "alice@example.com",
        null,
      );
      const githubIdArg = mockCreateUser.mock.calls[0]?.[0] as number;
      expect(githubIdArg).toBeLessThan(0);
      expect(mockAddOrgMember).toHaveBeenCalledWith("org-1", "user-sso-1", "member");
      expect(mockCreateToken).toHaveBeenCalled();
    });

    it("updates existing user on valid SAML response", async () => {
      const samlConfig: SamlConfig = {
        orgId: "org-1",
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: testCertPem,
        spEntityId: "https://api.kindlm.com/auth/saml",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      mockGetEnabledSamlConfigs.mockResolvedValue([samlConfig]);
      mockGetUserByEmail.mockResolvedValue({
        id: "user-existing",
        githubId: 123,
        githubLogin: "old-name",
        email: "alice@example.com",
        avatarUrl: null,
        createdAt: "2025-06-01T00:00:00Z",
      });
      mockGetOrgMember.mockResolvedValue({
        orgId: "org-1",
        userId: "user-existing",
        role: "member",
        createdAt: "2025-06-01T00:00:00Z",
      });

      const mockD1 = createMockD1();

      const app = createMockApp();
      const xml = await buildSamlResponse({
        nameId: "alice@example.com",
        attributes: { displayName: "Alice New Name" },
      });
      const b64 = samlResponseToBase64(xml);
      const env = { ...testEnv, DB: mockD1 as unknown as D1Database };
      const res = await app.request(
        "/auth/saml/callback",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: makeFormBody({ SAMLResponse: b64 }),
        },
        env,
        testExecutionCtx,
      );

      expect(res.status).toBe(200);

      // Should NOT create a new user
      expect(mockCreateUser).not.toHaveBeenCalled();
      // Should update the display name
      expect(mockUpdateUser).toHaveBeenCalledWith("user-existing", {
        githubLogin: "Alice New Name",
      });
      // Should NOT re-add org member since they already exist
      expect(mockAddOrgMember).not.toHaveBeenCalled();
    });

    it("redirects to dashboard when RelayState contains allowed origin", async () => {
      const samlConfig: SamlConfig = {
        orgId: "org-1",
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: testCertPem,
        spEntityId: "https://api.kindlm.com/auth/saml",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      mockGetEnabledSamlConfigs.mockResolvedValue([samlConfig]);
      mockGetUserByEmail.mockResolvedValue(null);
      mockGetOrgMember.mockResolvedValue(null);

      const mockD1 = createMockD1();
      mockD1._configureResponse("INSERT INTO auth_codes", { changes: 1 });

      const app = createMockApp();
      const xml = await buildSamlResponse({ nameId: "bob@example.com" });
      const b64 = samlResponseToBase64(xml);
      const env = { ...testEnv, DB: mockD1 as unknown as D1Database };
      const res = await app.request(
        "/auth/saml/callback",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: makeFormBody({
            SAMLResponse: b64,
            RelayState: "http://localhost:3001/dashboard",
          }),
        },
        env,
        testExecutionCtx,
      );

      expect(res.status).toBe(302);
      const location = res.headers.get("Location") ?? "";
      expect(location).toContain("localhost:3001/dashboard");
      expect(location).toContain("code=");
    });

    it("returns 400 when no email found in assertion", async () => {
      const samlConfig: SamlConfig = {
        orgId: "org-1",
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: testCertPem,
        spEntityId: "https://api.kindlm.com/auth/saml",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
      };
      mockGetEnabledSamlConfigs.mockResolvedValue([samlConfig]);

      const app = createMockApp();

      // Build a SAML response manually without NameID
      const assertionBody = `<saml:Issuer>https://idp.example.com</saml:Issuer><saml:Conditions NotBefore="${new Date(Date.now() - 300_000).toISOString()}" NotOnOrAfter="${new Date(Date.now() + 300_000).toISOString()}"></saml:Conditions><saml:Subject></saml:Subject>`;
      const unsignedXml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}</saml:Assertion></samlp:Response>`;
      const digestBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(unsignedXml));
      const digestB64 = bytesToBase64(new Uint8Array(digestBuf));
      const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI=""><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${digestB64}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
      const signedInfoBytes = new TextEncoder().encode(signedInfo);
      const signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" },
        testKeyPair.privateKey,
        signedInfoBytes,
      );
      const sigB64 = bytesToBase64(new Uint8Array(signature));
      const signatureXml = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<ds:SignatureValue>${sigB64}</ds:SignatureValue></ds:Signature>`;

      const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}${signatureXml}</saml:Assertion></samlp:Response>`;

      const b64 = samlResponseToBase64(xml);
      const res = await req(app, "/auth/saml/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: makeFormBody({ SAMLResponse: b64 }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("No email found in SAML assertion");
    });
  });

  // ------- XML parsing unit tests -------

  describe("extractNameID", () => {
    it("extracts from saml:NameID", () => {
      const xml = `<saml:NameID Format="email">user@test.com</saml:NameID>`;
      expect(extractNameID(xml)).toBe("user@test.com");
    });

    it("extracts from saml2:NameID", () => {
      const xml = `<saml2:NameID>admin@corp.com</saml2:NameID>`;
      expect(extractNameID(xml)).toBe("admin@corp.com");
    });

    it("extracts from bare NameID", () => {
      const xml = `<NameID>plain@example.com</NameID>`;
      expect(extractNameID(xml)).toBe("plain@example.com");
    });

    it("returns null when no NameID", () => {
      expect(extractNameID("<Assertion></Assertion>")).toBeNull();
    });
  });

  describe("extractAttribute", () => {
    it("extracts standard attribute", () => {
      const xml = `<saml:Attribute Name="displayName"><saml:AttributeValue>Alice</saml:AttributeValue></saml:Attribute>`;
      expect(extractAttribute(xml, "displayName")).toBe("Alice");
    });

    it("extracts URI-named attribute", () => {
      const xml = `<saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"><saml:AttributeValue>a@b.com</saml:AttributeValue></saml:Attribute>`;
      expect(
        extractAttribute(
          xml,
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        ),
      ).toBe("a@b.com");
    });

    it("returns null when attribute not found", () => {
      expect(extractAttribute("<Assertion/>", "missing")).toBeNull();
    });
  });

  describe("extractIssuer", () => {
    it("extracts from saml:Issuer", () => {
      const xml = `<saml:Issuer>https://idp.example.com</saml:Issuer>`;
      expect(extractIssuer(xml)).toBe("https://idp.example.com");
    });

    it("returns null when no Issuer", () => {
      expect(extractIssuer("<Response/>")).toBeNull();
    });
  });

  describe("checkConditions", () => {
    it("accepts when no Conditions element", () => {
      expect(checkConditions("<Assertion/>")).toEqual({ valid: true });
    });

    it("accepts when within valid time window", () => {
      const nb = new Date(Date.now() - 60_000).toISOString();
      const noa = new Date(Date.now() + 60_000).toISOString();
      const xml = `<saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}"/>`;
      expect(checkConditions(xml)).toEqual({ valid: true });
    });

    it("rejects when expired", () => {
      const nb = new Date(Date.now() - 600_000).toISOString();
      const noa = new Date(Date.now() - 300_000).toISOString();
      const xml = `<saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}"/>`;
      const result = checkConditions(xml);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("rejects when not yet valid", () => {
      const nb = new Date(Date.now() + 300_000).toISOString();
      const noa = new Date(Date.now() + 600_000).toISOString();
      const xml = `<saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}"/>`;
      const result = checkConditions(xml);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("NotBefore");
    });
  });

  // ------- Signature verification -------

  describe("verifySamlSignature", () => {
    it("returns true for valid signature", async () => {
      const xml = await buildSamlResponse();
      const result = await verifySamlSignature(xml, testCertPem);
      expect(result).toBe(true);
    });

    it("returns false when signature is tampered", async () => {
      let xml = await buildSamlResponse();
      // Tamper with the signature value
      xml = xml.replace(
        /<ds:SignatureValue>([^<]+)</,
        "<ds:SignatureValue>AAAA$1",
      );
      const result = await verifySamlSignature(xml, testCertPem);
      expect(result).toBe(false);
    });

    it("returns false when no SignatureValue present", async () => {
      const xml = await buildSamlResponse({ sign: false });
      const result = await verifySamlSignature(xml, testCertPem);
      expect(result).toBe(false);
    });

    it("returns false for invalid certificate PEM", async () => {
      const xml = await buildSamlResponse();
      const result = await verifySamlSignature(xml, "not-a-certificate");
      expect(result).toBe(false);
    });

    it("returns false for XML Signature Wrapping (XSW) attack", async () => {
      // Build a legitimately signed response
      const legitimateXml = await buildSamlResponse({
        nameId: "legitimate@example.com",
      });

      // XSW attack: wrap the legitimate signed response inside a new envelope
      // and inject a malicious assertion at the top level that the parser should ignore.
      const maliciousAssertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>https://idp.example.com</saml:Issuer><saml:Subject><saml:NameID>attacker@evil.com</saml:NameID></saml:Subject></saml:Assertion>`;

      // Insert the malicious assertion before the legitimate Response
      const xswXml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><Evil>${maliciousAssertion}</Evil>${legitimateXml}</samlp:Response>`;

      // The signature should fail because the document structure has changed
      // and the digest over the original document no longer matches
      const result = await verifySamlSignature(xswXml, testCertPem);
      expect(result).toBe(false);
    });

    it("returns false when digest value is tampered", async () => {
      let xml = await buildSamlResponse();
      // Tamper with the DigestValue
      xml = xml.replace(
        /<ds:DigestValue>([^<]+)<\/ds:DigestValue>/,
        "<ds:DigestValue>dGFtcGVyZWQ=</ds:DigestValue>",
      );
      const result = await verifySamlSignature(xml, testCertPem);
      expect(result).toBe(false);
    });
  });

  // ------- ECDSA support -------

  describe("ECDSA signature verification", () => {
    let ecKeyPair: CryptoKeyPair;
    let ecCertPem: string;

    beforeAll(async () => {
      const result = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      ecKeyPair = result as CryptoKeyPair;
      const spki = await crypto.subtle.exportKey("spki", ecKeyPair.publicKey) as ArrayBuffer;
      const b64 = bytesToBase64(new Uint8Array(spki));
      ecCertPem = wrapPem(b64, "PUBLIC KEY");
    });

    it("verifies a valid ECDSA P-256 signature", async () => {
      // Build an unsigned SAML response, then sign it with ECDSA
      const issuer = "https://idp.example.com";
      const nameId = "ecdsa-user@example.com";
      const nb = new Date(Date.now() - 300_000).toISOString();
      const noa = new Date(Date.now() + 300_000).toISOString();

      const assertionBody = `<saml:Issuer>${issuer}</saml:Issuer><saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}"></saml:Conditions><saml:Subject><saml:NameID>${nameId}</saml:NameID></saml:Subject>`;
      const unsignedXml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}</saml:Assertion></samlp:Response>`;

      const digestBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(unsignedXml));
      const digestB64 = bytesToBase64(new Uint8Array(digestBuf));

      const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/><ds:Reference URI=""><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${digestB64}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

      const signedInfoBytes = new TextEncoder().encode(signedInfo);
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        ecKeyPair.privateKey,
        signedInfoBytes,
      );
      const sigB64 = bytesToBase64(new Uint8Array(signature));

      const signatureXml = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<ds:SignatureValue>${sigB64}</ds:SignatureValue></ds:Signature>`;

      const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}${signatureXml}</saml:Assertion></samlp:Response>`;

      const result = await verifySamlSignature(xml, ecCertPem);
      expect(result).toBe(true);
    });

    it("rejects ECDSA signature with wrong key", async () => {
      // Sign with ecKeyPair but verify with the RSA testCertPem
      const issuer = "https://idp.example.com";
      const nameId = "ecdsa-user@example.com";
      const nb = new Date(Date.now() - 300_000).toISOString();
      const noa = new Date(Date.now() + 300_000).toISOString();

      const assertionBody = `<saml:Issuer>${issuer}</saml:Issuer><saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}"></saml:Conditions><saml:Subject><saml:NameID>${nameId}</saml:NameID></saml:Subject>`;
      const unsignedXml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}</saml:Assertion></samlp:Response>`;

      const digestBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(unsignedXml));
      const digestB64 = bytesToBase64(new Uint8Array(digestBuf));

      const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/><ds:Reference URI=""><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${digestB64}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

      const signedInfoBytes = new TextEncoder().encode(signedInfo);
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        ecKeyPair.privateKey,
        signedInfoBytes,
      );
      const sigB64 = bytesToBase64(new Uint8Array(signature));

      const signatureXml = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<ds:SignatureValue>${sigB64}</ds:SignatureValue></ds:Signature>`;

      const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Assertion>${assertionBody}${signatureXml}</saml:Assertion></samlp:Response>`;

      // Verify with the RSA key — should fail because algorithm mismatch
      const result = await verifySamlSignature(xml, testCertPem);
      expect(result).toBe(false);
    });
  });
});
