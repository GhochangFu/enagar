/** Ratified in ADR-0014 (EN-27). Single source for API, worker, and admin portals. */
export const FORM_IMPORT_POLICY = {
  apply_mode: 'replace' as const,
  reimport_targets_draft_only: true,
  min_overall_confidence: 0.5,
  min_accepted_field_confidence: 0.65,
  warn_field_confidence_below: 0.85,
  store_source_on_job: true,
  store_source_on_draft_metadata: false,
  excel_locale_columns_in_mvp: true,
  handwritten_rejection_message:
    'Handwritten forms are not supported yet. Please use a typed PDF, Word, or Excel template.',
} as const;

export type FormImportApplyMode = (typeof FORM_IMPORT_POLICY)['apply_mode'];
