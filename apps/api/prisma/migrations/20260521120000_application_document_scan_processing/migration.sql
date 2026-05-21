ALTER TABLE application_documents DROP CONSTRAINT application_documents_scan_status_check;

ALTER TABLE application_documents ADD CONSTRAINT application_documents_scan_status_check CHECK (
  scan_status IN ('pending', 'processing', 'clean', 'infected', 'failed')
);
