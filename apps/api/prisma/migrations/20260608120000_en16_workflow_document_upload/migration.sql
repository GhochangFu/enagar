-- EN-16: per-stage context-action attachments from internal tenant users.
ALTER TABLE application_documents
  ADD COLUMN workflow_stage_code VARCHAR(80),
  ADD COLUMN uploaded_by_role    VARCHAR(60),
  ADD COLUMN note                VARCHAR(500);

CREATE INDEX application_documents_application_stage_idx
  ON application_documents (application_id, workflow_stage_code);

-- Backfill: existing rows predate this feature and were uploaded at submission by citizens.
UPDATE application_documents
SET workflow_stage_code = 'submission',
    uploaded_by_role    = 'citizen'
WHERE workflow_stage_code IS NULL;
