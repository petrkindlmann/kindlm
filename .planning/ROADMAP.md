# KindLM Launch Ops Roadmap

## Phase 1: Deploy Everything

**Goal:** Fix CI blockers, push code, deploy worker, run migrations, confirm v2.0.0 publish, complete manual credential setup
**Requirements:** OPS-01 through OPS-08
**Plans:** 1/3 plans executed

Plans:
- [x] 01-01-PLAN.md -- Fix CI blockers (typecheck + lint errors) and verify migration state
- [ ] 01-02-PLAN.md -- Push to remote, deploy Cloud Worker, run D1 migrations, confirm v2.0.0
- [ ] 01-03-PLAN.md -- Manual steps: CF_API_TOKEN, SENTRY_DSN, VS Code extension, Stripe products

**Success:** v2.0.0 on npm, Cloud Worker deployed with new features, all migrations applied, monitoring and billing configured
