-- Performance indexes for common query patterns identified during audit.
-- These cover hot paths in billing, audit log, webhook, and user lookups.

-- Billing: getBillingByCustomerId scans by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_billing_stripe_customer
  ON billing(stripe_customer_id);

-- Audit log: listAuditLog filters by action and resource_type
CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_log(org_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON audit_log(org_id, resource_type, created_at DESC);

-- Webhooks: listWebhooksByEvent filters active webhooks by org
CREATE INDEX IF NOT EXISTS idx_webhooks_org_active
  ON webhooks(org_id, active);

-- Users: getUserByEmail scans by email (SSO login flow)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);
