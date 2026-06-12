-- EN-20 / 2026-06-12: The EN-19 migration created lease_agreement_document_events
-- with the column named `eventType` (no `@map` in the original schema), but the
-- Prisma client maps the model field to the snake_case column name `event_type`
-- (the schema now declares `@map("event_type")`). Rename the column to match
-- the schema so Prisma can address it correctly.
ALTER TABLE "lease_agreement_document_events"
  RENAME COLUMN "eventType" TO "event_type";
