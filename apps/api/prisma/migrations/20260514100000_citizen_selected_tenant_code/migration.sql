-- Citizen portal preference (Phase 1 Sprint 1.1). Used when select-tenant persists last ULB.
ALTER TABLE "citizens" ADD COLUMN "selected_tenant_code" VARCHAR(20);
