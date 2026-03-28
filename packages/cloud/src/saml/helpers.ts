import type { AppEnv } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SP_ENTITY_ID = "https://api.kindlm.com/auth/saml";
export const ACS_URL = "https://api.kindlm.com/auth/saml/callback";
export const AUTH_CODE_TTL_SECONDS = 30;

// ---------------------------------------------------------------------------
// XML parsing helpers — lightweight string-based extraction for SAML responses
// ---------------------------------------------------------------------------

export function extractNameID(xml: string): string | null {
  const match = xml.match(/<(?:saml[2p]?:)?NameID[^>]*>([^<]+)</);
  return match?.[1]?.trim() ?? null;
}

export function extractAttribute(xml: string, name: string): string | null {
  const attrRegex = new RegExp(
    `<(?:saml[2p]?:)?Attribute[^>]*Name=["']${escapeRegex(name)}["'][^>]*>[\\s\\S]*?<(?:saml[2p]?:)?AttributeValue[^>]*>([^<]+)`,
    "i",
  );
  const match = xml.match(attrRegex);
  return match?.[1]?.trim() ?? null;
}

export function extractIssuer(xml: string): string | null {
  const match = xml.match(/<(?:saml[2p]?:)?Issuer[^>]*>([^<]+)</);
  return match?.[1]?.trim() ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function ssoGithubId(email: string): Promise<number> {
  const data = new TextEncoder().encode(`sso:${email}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const view = new DataView(hash);
  // Use first 6 bytes as negative int (safe in JS, avoids collision with real GitHub IDs)
  return -(view.getUint32(0) * 65536 + view.getUint16(4));
}

export function extractAssertionId(xml: string): string | null {
  const match = xml.match(/<(?:saml[2p]?:)?Assertion[^>]*\sID=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

export function escapeHtml(s: string): string {
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

export function checkConditions(xml: string): { valid: boolean; error?: string } {
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

export function base64ToBytes(b64: string): Uint8Array {
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

export function canonicalizeSignedInfo(signedInfo: string, fullXml: string): string {
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

// ---------------------------------------------------------------------------
// Dashboard redirect helpers
// ---------------------------------------------------------------------------

export function getAllowedOrigins(env: AppEnv["Bindings"]): string[] {
  const origins = ["https://cloud.kindlm.com"];
  if (env.ENVIRONMENT !== "production") {
    origins.push("http://localhost:3001");
  }
  return origins;
}
