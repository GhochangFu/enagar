-- EN-20 / 2026-06-12: lease_agreement_documents and lease_agreement_document_events
-- originally declared `uploaded_by` / `reviewed_by` / `actor_user_id` as UUID,
-- but the tenant-staff JWT `sub` is the Keycloak username (per the
-- `sub-username` mapper, see docs/runbooks/keycloak.md), so writes 500'd with
-- `invalid input syntax for type uuid: "kmc-tenant-admin-dummy"`. Relax the
-- columns to VARCHAR(255) to match the actual auth principal shape.
ALTER TABLE "lease_agreement_documents"
  ALTER COLUMN "uploaded_by" TYPE VARCHAR(255),
  ALTER COLUMN "reviewed_by" TYPE VARCHAR(255);

ALTER TABLE "lease_agreement_document_events"
  ALTER COLUMN "actor_user_id" TYPE VARCHAR(255);
