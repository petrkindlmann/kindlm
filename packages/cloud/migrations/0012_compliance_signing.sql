-- Add compliance signing columns to runs table for enterprise signed reports.
-- compliance_signature stores the Ed25519 signature (base64).
-- compliance_signed_at stores the ISO 8601 timestamp of when the report was signed.
ALTER TABLE runs ADD COLUMN compliance_signature TEXT;
ALTER TABLE runs ADD COLUMN compliance_signed_at TEXT;
