# Plan 03-01: SAML XML Parser + Signed Compliance Reports

## Status: COMPLETE

## What Was Done

### 1. Added `fast-xml-parser` dependency
- `packages/cloud/package.json`: added `fast-xml-parser: ^5.5.9` to dependencies

### 2. Created SAML XML parser module (`packages/cloud/src/saml/`)
- **`xml-parser.ts`**: SAML-aware XML parser wrapping fast-xml-parser with:
  - Namespace-aware tag resolution (saml:, saml2:, samlp:, ds:, bare)
  - Deep-search fallback for XML fragment tolerance (backward compatible with unit tests)
  - `extractSignatureFromParsed()` — XSW defense: only trusts Signature as direct child of Assertion
  - Structured extraction: NameID, Attribute, Issuer, AssertionId, Conditions, Signature
- **`helpers.ts`**: Extracted and rewritten SAML helpers:
  - All extraction functions now use parsed XML tree instead of regex
  - `verifySamlSignature()` rewritten to validate structure via parsed tree before crypto
  - Added ECDSA P-256 and P-384 support via `getAlgorithmConfig()`
  - Graceful error handling for invalid base64 in tampered signatures
  - All original function signatures preserved exactly
- **`index.ts`**: Barrel export for the saml module

### 3. Rewrote `sso.ts` route handler
- Removed all inline XML helpers (extractNameID, extractAttribute, etc.)
- Imports everything from `../saml/helpers.js`
- Re-exports helpers for backward compatibility with existing test imports
- All route handler logic unchanged

### 4. XSW (XML Signature Wrapping) defense
- `extractSignatureFromParsed()` only looks at the Assertion's direct children for `<ds:Signature>`
- Attacker-injected signatures in wrapper elements are ignored
- Digest verification happens over the referenced element, catching document tampering

### 5. ECDSA P-256 support
- `getAlgorithmConfig()` now handles `ecdsa-sha256` and `ecdsa-sha384` algorithm URIs
- Uses Web Crypto ECDSA with named curves P-256 and P-384

### 6. Created migration `0011_compliance_signing.sql`
- Adds `compliance_signature TEXT` column to `runs` table
- Adds `compliance_signed_at TEXT` column to `runs` table

### 7. Updated Run type and queries
- `types.ts`: Added `complianceSignature` and `complianceSignedAt` to `Run` interface
- `db/queries.ts`: Updated `mapRun()`, `createRun()`, and `updateRun()` to include new fields
- Updated 5 test files with the new Run fields

### 8. Added run-level compliance signing endpoints
- **`POST /v1/compliance/sign-report`**: Signs a run's compliance report with Ed25519
  - Validates run exists, belongs to org, has a report, is not already signed
  - Stores signature + signedAt on the run record
- **`POST /v1/compliance/verify-report`**: Verifies a run's compliance report signature
  - Returns `{ valid, algorithm, signedAt }`

### 9. Test coverage
- **4 new SSO tests**: XSW attack detection, digest tampering, ECDSA valid signature, ECDSA wrong key
- **11 new compliance tests**: sign-report validation (6), verify-report validation (3), roundtrip (1), plan gating (1)
- **Total**: 270 cloud tests passing (was 255), zero type errors

## Files Created
- `packages/cloud/src/saml/xml-parser.ts`
- `packages/cloud/src/saml/helpers.ts`
- `packages/cloud/src/saml/index.ts`
- `packages/cloud/migrations/0011_compliance_signing.sql`
- `.planning/phases/03-enterprise-features/03-01-SUMMARY.md`

## Files Modified
- `packages/cloud/package.json` (added fast-xml-parser)
- `packages/cloud/src/routes/sso.ts` (rewrote to use saml/ module)
- `packages/cloud/src/routes/sso.test.ts` (added 4 tests)
- `packages/cloud/src/routes/compliance.ts` (added sign-report/verify-report)
- `packages/cloud/src/routes/compliance.test.ts` (added 11 tests)
- `packages/cloud/src/types.ts` (added Run fields)
- `packages/cloud/src/db/queries.ts` (updated mapRun, createRun, updateRun)
- `packages/cloud/src/routes/baselines.test.ts` (added Run fields)
- `packages/cloud/src/routes/compare.test.ts` (added Run fields)
- `packages/cloud/src/routes/results.test.ts` (added Run fields)
- `packages/cloud/src/routes/runs.test.ts` (added Run fields)
- `packages/cloud/src/webhooks/dispatch.test.ts` (added Run fields)

## Verification
- 270/270 cloud tests passing
- 0 TypeScript errors
- All 255 original tests still pass
- 15 new tests all pass
