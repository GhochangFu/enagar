-- SSA-1 (EN-53): Service Setup Assistant foundation tables

CREATE TABLE "service_setup_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "service_id" UUID,
  "global_service_code" VARCHAR(80),
  "staff_subject_id" VARCHAR(255) NOT NULL,
  "scope" VARCHAR(20) NOT NULL,
  "current_step" INTEGER NOT NULL DEFAULT 1,
  "archetype" VARCHAR(80),
  "requirements_json" JSONB,
  "step_completion" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_setup_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_setup_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "tool_calls" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_setup_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_setup_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "staff_subject_id" VARCHAR(255) NOT NULL,
  "tool_name" VARCHAR(120) NOT NULL,
  "step" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL,
  "input_summary" JSONB,
  "error_message" TEXT,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_setup_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_setup_sessions_tenant_id_service_id_idx"
  ON "service_setup_sessions"("tenant_id", "service_id");
CREATE INDEX "service_setup_sessions_staff_subject_id_idx"
  ON "service_setup_sessions"("staff_subject_id");
CREATE INDEX "service_setup_messages_session_id_created_at_idx"
  ON "service_setup_messages"("session_id", "created_at");
CREATE INDEX "service_setup_messages_tenant_id_created_at_idx"
  ON "service_setup_messages"("tenant_id", "created_at" DESC);
CREATE INDEX "service_setup_audit_logs_tenant_id_created_at_idx"
  ON "service_setup_audit_logs"("tenant_id", "created_at" DESC);
CREATE INDEX "service_setup_audit_logs_session_id_created_at_idx"
  ON "service_setup_audit_logs"("session_id", "created_at");

ALTER TABLE "service_setup_sessions"
  ADD CONSTRAINT "service_setup_sessions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_setup_sessions"
  ADD CONSTRAINT "service_setup_sessions_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_setup_messages"
  ADD CONSTRAINT "service_setup_messages_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_setup_messages"
  ADD CONSTRAINT "service_setup_messages_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "service_setup_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_setup_audit_logs"
  ADD CONSTRAINT "service_setup_audit_logs_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "service_setup_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_setup_audit_logs"
  ADD CONSTRAINT "service_setup_audit_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
