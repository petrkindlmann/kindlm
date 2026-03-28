// SAML-aware XML parser wrapping fast-xml-parser.
// Provides safe traversal helpers that account for SAML namespace prefixes.

import { XMLParser } from "fast-xml-parser";

const SAML_NS_PREFIXES = ["saml:", "saml2:", "saml2p:", "samlp:", ""] as const;
const DS_NS_PREFIXES = ["ds:", ""] as const;

interface ParsedXml {
  [key: string]: unknown;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Preserve text content even inside mixed elements
  textNodeName: "#text",
  // Don't strip whitespace from text values
  trimValues: true,
  // Parse attributes as strings, not numbers
  parseAttributeValue: false,
  // Don't coerce tag values
  parseTagValue: false,
});

export function parseSamlXml(xml: string): ParsedXml {
  return parser.parse(xml) as ParsedXml;
}

// Resolve a tag name across namespace prefixes
function resolveTag(obj: ParsedXml, localName: string, prefixes: readonly string[]): unknown {
  for (const prefix of prefixes) {
    const key = `${prefix}${localName}`;
    if (key in obj) return obj[key];
  }
  return undefined;
}

function resolveSamlTag(obj: ParsedXml, localName: string): unknown {
  return resolveTag(obj, localName, SAML_NS_PREFIXES);
}

function resolveDsTag(obj: ParsedXml, localName: string): unknown {
  return resolveTag(obj, localName, DS_NS_PREFIXES);
}

// Get the top-level Response element regardless of namespace prefix
function getResponse(doc: ParsedXml): ParsedXml | null {
  const prefixes = ["samlp:", "saml2p:", ""] as const;
  for (const prefix of prefixes) {
    const key = `${prefix}Response`;
    if (key in doc && typeof doc[key] === "object" && doc[key] !== null) {
      return doc[key] as ParsedXml;
    }
  }
  return null;
}

// Get the Assertion element from Response, top-level doc, or return doc itself
// if the doc directly contains assertion-level elements (for fragment tolerance).
function getAssertion(doc: ParsedXml): ParsedXml | null {
  const response = getResponse(doc);
  const searchIn = response ?? doc;
  const val = resolveSamlTag(searchIn as ParsedXml, "Assertion");
  if (typeof val === "object" && val !== null) return val as ParsedXml;
  return null;
}

// Recursively search the parsed tree for a tag with the given local name
// across all SAML namespace prefixes. Returns the first match.
function deepFindSamlTag(obj: unknown, localName: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parsed = obj as ParsedXml;

  // Check direct children first
  const direct = resolveSamlTag(parsed, localName);
  if (direct !== undefined) return direct;

  // Recurse into child objects (skip attribute keys)
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith("@_") || key === "#text") continue;
    if (typeof value === "object" && value !== null) {
      const found = deepFindSamlTag(value, localName);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function deepFindDsTag(obj: unknown, localName: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parsed = obj as ParsedXml;

  const direct = resolveDsTag(parsed, localName);
  if (direct !== undefined) return direct;

  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith("@_") || key === "#text") continue;
    if (typeof value === "object" && value !== null) {
      const found = deepFindDsTag(value, localName);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

// Extract text from a parsed value that may be a string or an object with #text
function extractText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "object" && value !== null) {
    const text = (value as ParsedXml)["#text"];
    if (typeof text === "string") return text.trim() || null;
  }
  return null;
}

export function extractNameIdFromParsed(doc: ParsedXml): string | null {
  // Try structured path first: Response > Assertion > Subject > NameID
  const assertion = getAssertion(doc);
  if (assertion) {
    const subject = resolveSamlTag(assertion, "Subject");
    if (subject && typeof subject === "object") {
      const nameId = resolveSamlTag(subject as ParsedXml, "NameID");
      if (nameId !== undefined && nameId !== null) {
        return extractText(nameId);
      }
    }
  }

  // Fallback: deep search for NameID anywhere in the document (handles fragments)
  const nameId = deepFindSamlTag(doc, "NameID");
  if (nameId !== undefined && nameId !== null) {
    return extractText(nameId);
  }

  return null;
}

export function extractAttributeFromParsed(doc: ParsedXml, name: string): string | null {
  // Try structured path: Assertion > AttributeStatement > Attribute
  const assertion = getAssertion(doc);
  const searchRoot = assertion ?? doc;

  const attrStatement = resolveSamlTag(searchRoot as ParsedXml, "AttributeStatement")
    ?? deepFindSamlTag(doc, "AttributeStatement");
  if (!attrStatement || typeof attrStatement !== "object") {
    // Fallback: look for Attribute directly (fragment case)
    return findAttributeValue(doc, name);
  }

  return findAttributeInStatement(attrStatement as ParsedXml, name);
}

function findAttributeInStatement(attrStatement: ParsedXml, name: string): string | null {
  const attributes = resolveSamlTag(attrStatement, "Attribute");
  if (!attributes) return null;

  const attrList = Array.isArray(attributes) ? attributes : [attributes];

  for (const attr of attrList) {
    if (typeof attr !== "object" || attr === null) continue;
    const parsed = attr as ParsedXml;
    const attrName = parsed["@_Name"];
    if (attrName !== name) continue;

    const attrValue = resolveSamlTag(parsed, "AttributeValue");
    return extractText(attrValue);
  }

  return null;
}

function findAttributeValue(doc: ParsedXml, name: string): string | null {
  // Deep search for Attribute elements
  const attr = deepFindSamlTag(doc, "Attribute");
  if (!attr) return null;

  const attrList = Array.isArray(attr) ? attr : [attr];
  for (const a of attrList) {
    if (typeof a !== "object" || a === null) continue;
    const parsed = a as ParsedXml;
    if (parsed["@_Name"] !== name) continue;
    const attrValue = resolveSamlTag(parsed, "AttributeValue");
    return extractText(attrValue);
  }
  return null;
}

export function extractIssuerFromParsed(doc: ParsedXml): string | null {
  // Try Response level first
  const response = getResponse(doc);
  if (response) {
    const issuer = resolveSamlTag(response, "Issuer");
    const text = extractText(issuer);
    if (text) return text;
  }

  // Try Assertion level
  const assertion = getAssertion(doc);
  if (assertion) {
    const issuer = resolveSamlTag(assertion, "Issuer");
    const text = extractText(issuer);
    if (text) return text;
  }

  // Fallback: deep search (handles fragments)
  const issuer = deepFindSamlTag(doc, "Issuer");
  return extractText(issuer);
}

export function extractAssertionIdFromParsed(doc: ParsedXml): string | null {
  const assertion = getAssertion(doc);
  if (!assertion) return null;
  const id = assertion["@_ID"];
  return typeof id === "string" ? id : null;
}

export interface ParsedConditions {
  notBefore?: string;
  notOnOrAfter?: string;
  found: boolean;
}

export function extractConditionsFromParsed(doc: ParsedXml): ParsedConditions {
  // Try structured path
  const assertion = getAssertion(doc);
  let conditions: unknown = null;

  if (assertion) {
    conditions = resolveSamlTag(assertion, "Conditions");
  }

  // Fallback: deep search (handles fragments like `<saml:Conditions ... />`)
  if (!conditions || typeof conditions !== "object") {
    conditions = deepFindSamlTag(doc, "Conditions");
  }

  if (!conditions || typeof conditions !== "object") return { found: false };

  const parsed = conditions as ParsedXml;
  return {
    found: true,
    notBefore: typeof parsed["@_NotBefore"] === "string" ? parsed["@_NotBefore"] : undefined,
    notOnOrAfter: typeof parsed["@_NotOnOrAfter"] === "string" ? parsed["@_NotOnOrAfter"] : undefined,
  };
}

// Extract the ds:Signature element from anywhere in the document.
// For XSW defense, we only trust the Signature that is a direct child of the Assertion.
export interface ParsedSignature {
  signedInfoXml: string;
  signatureValue: string;
  signatureMethodAlgorithm: string;
  digestMethodAlgorithm: string;
  digestValue: string;
  referenceUri: string;
}

// Extract Signature data using the parsed tree for validation,
// but we still need raw XML substrings for cryptographic verification.
// This function validates the structure via the parsed tree, then
// extracts the raw XML strings needed for crypto.
export function extractSignatureFromParsed(
  doc: ParsedXml,
  rawXml: string,
): ParsedSignature | null {
  // XSW defense: only trust Signature as a direct child of the Assertion element.
  // An attacker could inject a second Signature in a wrapper element —
  // by only looking at the Assertion's direct children, we ignore injected signatures.
  const assertion = getAssertion(doc);
  if (!assertion) return null;

  const signature = resolveDsTag(assertion, "Signature");
  if (!signature || typeof signature !== "object") return null;

  const sig = signature as ParsedXml;
  const signedInfo = resolveDsTag(sig, "SignedInfo");
  if (!signedInfo || typeof signedInfo !== "object") return null;

  // Extract SignatureValue
  const sigValue = resolveDsTag(sig, "SignatureValue");
  const signatureValue = typeof sigValue === "string"
    ? sigValue.replace(/\s/g, "")
    : typeof sigValue === "object" && sigValue !== null
      ? String((sigValue as ParsedXml)["#text"] ?? "").replace(/\s/g, "")
      : null;
  if (!signatureValue) return null;

  const si = signedInfo as ParsedXml;

  // Extract SignatureMethod Algorithm
  const sigMethod = resolveDsTag(si, "SignatureMethod");
  const signatureMethodAlgorithm = typeof sigMethod === "object" && sigMethod !== null
    ? String((sigMethod as ParsedXml)["@_Algorithm"] ?? "")
    : "";

  // Extract Reference
  const reference = resolveDsTag(si, "Reference");
  if (!reference || typeof reference !== "object") return null;
  const ref = reference as ParsedXml;
  const referenceUri = typeof ref["@_URI"] === "string" ? ref["@_URI"] : "";

  // Extract DigestMethod Algorithm
  const digestMethod = resolveDsTag(ref, "DigestMethod");
  const digestMethodAlgorithm = typeof digestMethod === "object" && digestMethod !== null
    ? String((digestMethod as ParsedXml)["@_Algorithm"] ?? "")
    : "";

  // Extract DigestValue
  const dv = resolveDsTag(ref, "DigestValue");
  const digestValue = typeof dv === "string"
    ? dv.replace(/\s/g, "")
    : typeof dv === "object" && dv !== null
      ? String((dv as ParsedXml)["#text"] ?? "").replace(/\s/g, "")
      : null;
  if (!digestValue) return null;

  // Extract raw SignedInfo XML from the original XML for cryptographic verification.
  // Regex is safe here because we already validated the structure via the parsed tree.
  const signedInfoMatch = rawXml.match(
    /<(?:ds:)?SignedInfo[^>]*>[\s\S]*?<\/(?:ds:)?SignedInfo>/,
  );
  if (!signedInfoMatch?.[0]) return null;

  return {
    signedInfoXml: signedInfoMatch[0],
    signatureValue,
    signatureMethodAlgorithm,
    digestMethodAlgorithm,
    digestValue,
    referenceUri,
  };
}
