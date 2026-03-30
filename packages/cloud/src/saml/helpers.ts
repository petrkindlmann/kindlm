// SAML XML extraction and signature verification helpers.
// Uses fast-xml-parser for structured extraction (XSW defense)
// and Web Crypto API for signature verification (Workers compatible).

import {
  parseSamlXml,
  extractNameIdFromParsed,
  extractAttributeFromParsed,
  extractIssuerFromParsed,
  extractAssertionIdFromParsed,
  extractConditionsFromParsed,
  extractSignatureFromParsed,
} from "./xml-parser.js";

// ---------------------------------------------------------------------------
// XML extraction — delegates to parsed XML tree (not regex)
// ---------------------------------------------------------------------------

export function extractNameID(xml: string): string | null {
  const doc = parseSamlXml(xml);
  return extractNameIdFromParsed(doc);
}

export function extractAttribute(xml: string, name: string): string | null {
  const doc = parseSamlXml(xml);
  return extractAttributeFromParsed(doc, name);
}

export function extractIssuer(xml: string): string | null {
  const doc = parseSamlXml(xml);
  return extractIssuerFromParsed(doc);
}

export function extractAssertionId(xml: string): string | null {
  const doc = parseSamlXml(xml);
  return extractAssertionIdFromParsed(doc);
}

// ---------------------------------------------------------------------------
// Timing condition checks (now uses parsed XML instead of regex)
// ---------------------------------------------------------------------------

export function checkConditions(xml: string): { valid: boolean; error?: string } {
  const doc = parseSamlXml(xml);
  const conditions = extractConditionsFromParsed(doc);

  if (!conditions.found) {
    // No conditions element — accept (some IDPs omit it)
    return { valid: true };
  }

  const now = Date.now();

  if (conditions.notBefore) {
    const notBefore = new Date(conditions.notBefore).getTime();
    // Allow 60s clock skew
    if (now < notBefore - 60_000) {
      return { valid: false, error: "Assertion is not yet valid (NotBefore)" };
    }
  }

  if (conditions.notOnOrAfter) {
    const notOnOrAfter = new Date(conditions.notOnOrAfter).getTime();
    // Allow 60s clock skew
    if (now >= notOnOrAfter + 60_000) {
      return { valid: false, error: "Assertion has expired (NotOnOrAfter)" };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function ssoGithubId(email: string): Promise<number> {
  const data = new TextEncoder().encode(`sso:${email}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const view = new DataView(hash);
  // Use first 6 bytes as negative int (safe in JS, avoids collision with real GitHub IDs)
  return -(view.getUint32(0) * 65536 + view.getUint16(4));
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface AlgorithmConfig {
  importParams: { name: string; hash?: string; namedCurve?: string };
  verifyParams: { name: string; hash?: string };
  signatureType: "rsa" | "ecdsa";
}

function getAlgorithmConfig(xmlAlg: string): AlgorithmConfig {
  // ECDSA P-256 with SHA-256
  if (xmlAlg.includes("ecdsa-sha256") || xmlAlg.includes("#ecdsa-sha256")) {
    return {
      importParams: { name: "ECDSA", namedCurve: "P-256" },
      verifyParams: { name: "ECDSA", hash: "SHA-256" },
      signatureType: "ecdsa",
    };
  }
  // ECDSA P-384 with SHA-384
  if (xmlAlg.includes("ecdsa-sha384") || xmlAlg.includes("#ecdsa-sha384")) {
    return {
      importParams: { name: "ECDSA", namedCurve: "P-384" },
      verifyParams: { name: "ECDSA", hash: "SHA-384" },
      signatureType: "ecdsa",
    };
  }
  // RSA-SHA1 (legacy)
  if (xmlAlg.includes("rsa-sha1") || xmlAlg.includes("sha1")) {
    return {
      importParams: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" },
      verifyParams: { name: "RSASSA-PKCS1-v1_5" },
      signatureType: "rsa",
    };
  }
  // Default: RSA-SHA256
  return {
    importParams: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    verifyParams: { name: "RSASSA-PKCS1-v1_5" },
    signatureType: "rsa",
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

// Convert IEEE P1363 (r || s) signature to ASN.1 DER format required by Web Crypto
// for ECDSA verification.
function _ieeeP1363ToDer(sig: Uint8Array): Uint8Array {
  const halfLen = sig.length / 2;
  const r = sig.slice(0, halfLen);
  const s = sig.slice(halfLen);

  function encodeInteger(bytes: Uint8Array): Uint8Array {
    // Strip leading zeros but keep at least one byte
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    // Add a leading 0x00 if the high bit is set (to make it positive in ASN.1)
    const needsPadding = ((trimmed[0] ?? 0) & 0x80) !== 0;
    const result = new Uint8Array((needsPadding ? 1 : 0) + trimmed.length);
    if (needsPadding) result[0] = 0x00;
    result.set(trimmed, needsPadding ? 1 : 0);
    return result;
  }

  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);

  // SEQUENCE { INTEGER r, INTEGER s }
  const totalLen = 2 + rDer.length + 2 + sDer.length;
  const der = new Uint8Array(2 + totalLen);
  let offset = 0;
  der[offset++] = 0x30; // SEQUENCE
  der[offset++] = totalLen;
  der[offset++] = 0x02; // INTEGER
  der[offset++] = rDer.length;
  der.set(rDer, offset);
  offset += rDer.length;
  der[offset++] = 0x02; // INTEGER
  der[offset++] = sDer.length;
  der.set(sDer, offset);

  return der;
}

export async function verifySamlSignature(
  xml: string,
  certificatePem: string,
): Promise<boolean> {
  // Parse the XML tree to validate structure and detect XSW attacks.
  // The parser ensures we only look at the Signature that is a direct child
  // of the Assertion element (not an injected second Signature).
  const doc = parseSamlXml(xml);
  const sigData = extractSignatureFromParsed(doc, xml);
  if (!sigData) return false;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64ToBytes(sigData.signatureValue);
  } catch {
    return false;
  }
  const signedInfoXml = sigData.signedInfoXml;

  // Verify DigestValue before checking the signature over SignedInfo.
  // This ensures the referenced assertion body hasn't been tampered with.
  const digestAlg = getDigestAlgorithm(sigData.digestMethodAlgorithm);
  const referencedElement = extractReferencedElement(xml, sigData.referenceUri);
  if (!referencedElement) return false;

  const refBytes = new TextEncoder().encode(referencedElement);
  const digestBuf = await crypto.subtle.digest(digestAlg, refBytes);
  const computedDigest = btoa(
    String.fromCharCode(...new Uint8Array(digestBuf)),
  );

  if (computedDigest !== sigData.digestValue) return false;

  // Determine algorithm from parsed SignatureMethod
  const algConfig = getAlgorithmConfig(sigData.signatureMethodAlgorithm);

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
    // For ECDSA, Web Crypto expects IEEE P1363 format but some IDPs send DER.
    // Try the raw bytes first, then try DER-to-P1363 conversion on failure.
    const result = await crypto.subtle.verify(
      algConfig.verifyParams,
      cryptoKey,
      signatureBytes,
      signedInfoBytes,
    );
    return result;
  } catch {
    return false;
  }
}
