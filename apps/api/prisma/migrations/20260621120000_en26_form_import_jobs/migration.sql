-- EN-45: Persist form-import jobs for async worker processing (EN-44).

CREATE TABLE "form_import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" VARCHAR(20) NOT NULL,
    "tenant_id" UUID,
    "service_id" UUID,
    "service_code" VARCHAR(80) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "source_filename" VARCHAR(500) NOT NULL,
    "source_mime_type" VARCHAR(200) NOT NULL,
    "source_kind" VARCHAR(30),
    "source_storage_key" VARCHAR(1000),
    "overall_confidence" DOUBLE PRECISION,
    "proposal_json" JSONB,
    "proposed_schema_json" JSONB,
    "rejection_reason" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "form_import_jobs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "form_import_jobs"
ADD CONSTRAINT "form_import_jobs_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_import_jobs"
ADD CONSTRAINT "form_import_jobs_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "form_import_jobs_tenant_id_service_id_created_at_idx"
ON "form_import_jobs"("tenant_id", "service_id", "created_at" DESC);

CREATE INDEX "form_import_jobs_scope_service_code_created_at_idx"
ON "form_import_jobs"("scope", "service_code", "created_at" DESC);

CREATE INDEX "form_import_jobs_status_created_at_idx"
ON "form_import_jobs"("status", "created_at");
