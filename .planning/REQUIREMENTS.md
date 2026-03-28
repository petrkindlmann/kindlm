# Requirements: KindLM v2

**Defined:** 2026-03-28
**Core Value:** The CLI must reliably test AI agent behavior end-to-end so developers trust it in CI pipelines.

## v1 Cleanup

- [ ] **CLEAN-01**: VS Code extension published to marketplace (publisher account + PAT)
- [ ] **CLEAN-02**: Stripe Products/Prices created in production dashboard, Worker secrets set

## CLI Enhancements

- [ ] **CLI-V2-01**: `--dry-run` mode validates config and prints test plan without API calls
- [ ] **CLI-V2-02**: `--watch` mode re-runs tests on kindlm.yaml change
- [ ] **CLI-V2-03**: Result caching to avoid duplicate LLM calls during iteration
- [ ] **CLI-V2-04**: GitHub Action that posts test results as PR comment
- [ ] **CLI-V2-05**: Generic HTTP provider adapter for custom APIs

## Enterprise

- [ ] **ENT-01**: SAML signature verification with proper XML parser (not regex)
- [ ] **ENT-02**: Signed compliance PDF reports
- [ ] **ENT-03**: Audit log API
- [ ] **ENT-04**: Automatic token rotation

## Infrastructure

- [ ] **INFRA-01**: Refactor queries.ts (1529 LOC) into domain modules
- [ ] **INFRA-02**: Refactor sso.ts (596 LOC) — separate SAML logic from route handlers
- [ ] **INFRA-03**: D1 index audit for query performance
- [ ] **INFRA-04**: Sentry error tracking for Workers

## Out of Scope

| Feature | Reason |
|---------|--------|
| GitHub org transfer | Nice-to-have, not blocking |
| Additional providers (Bedrock, Azure) | No demand signal |
| Mobile/native clients | Web-only |
| Self-hosted Cloud docs | No enterprise demand yet |
