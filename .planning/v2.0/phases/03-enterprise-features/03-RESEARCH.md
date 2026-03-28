# Phase 3: Enterprise Features — Research

**Date:** 2026-03-28

## ENT-01: SAML XML Parser
Current saml/helpers.ts (283 LOC) uses regex for all XML extraction and signature verification. Vulnerable to XML Signature Wrapping (XSW), namespace confusion, comment injection. Replace with `fast-xml-parser` v5 (pure JS, Workers-compatible, ~45KB). Create xml-parser.ts wrapper. Add ECDSA support.

## ENT-02: Signed Compliance Reports
compliance.ts already has Ed25519 sign/verify/public-key endpoints (enterprise-gated). Gap: no run-level integration, no inline signature metadata. Add `POST /sign-report` (signs run's compliance_report), `POST /verify-report`. Add HMAC-SHA256 for inline tamper evidence. Migration: add compliance_signature/compliance_signed_at to runs table.

## ENT-03: Audit Log API
audit.ts already functional with pagination, filtering by action/resourceType/since/until. Missing: actorId filter, cursor-based pagination, CSV export endpoint. Add D1 index on (org_id, actor_id, created_at DESC).

## ENT-04: Token Rotation
Tokens already have expires_at, cron cleanup exists. Missing: rotate endpoint (new token from valid old one), refresh endpoint (from bearer), org-level default TTL config. Add token_default_ttl_hours to orgs table.
