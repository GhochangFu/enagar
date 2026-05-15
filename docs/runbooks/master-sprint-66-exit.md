# Master Sprint 6.6 Exit — Catalogue Alignment

Status: **closed engineering** pending human acceptance smoke.

## Deliverables

- `GET /api/services/tenants/:tenantCode` and `GET /api/services/tenants/:tenantCode/:serviceCode` now read active Postgres `TenantService` rows and require a latest published `service_form_versions` row.
- Service responses include the citizen runtime form payload: `form_version_id`, `form_version`, `form_schema`, `ui_schema`, `form_published_at`, effective fee config, document checklist codes, revenue head, and accounting code.
- Application draft creation validates against the published DB form schema and stores `form_version_id` in the persisted application row/runtime snapshot.
- Prisma seed publishes the priority citizen form schemas into `service_form_versions` so local smoke starts from DB-backed catalogue state after `pnpm db:seed`.
- Citizen PWA and mobile apply flows render `selectedService.form_schema` from the service API; bundled service-schema maps were retired as runtime source of truth and remain only as dev prefill helpers.
- Security contract `tests/security/master-sprint-66.spec.ts` guards the API, seed, PWA, and mobile runtime contract.

## Exit Criteria

- Citizen service lists only active services with a published form version.
- Tenant Admin publishing a form changes the citizen runtime payload without rebuilding PWA/mobile.
- Citizen PWA and mobile render forms from API catalogue rows, not `@enagar/forms/fixtures`.
- Draft applications persist the exact published `service_form_versions.id` used for validation.
- Effective fee/document/revenue metadata still flows through the same service response used by payments and detail panels.
- Existing hub KPI and payment ledger paths still typecheck/test with the async DB-backed service resolver.

## Explicit Non-Goals

- No visual drag-drop form/workflow designer polish; that remains Sprint 6.7.
- No global service library curator UI.
- No live Keycloak provisioning or production impersonation handoff changes.
- No SMS/email/RAG indexing.

## Verification Commands

```bash
pnpm --filter @enagar/api prisma:validate
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test -- services.service.spec.ts
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/mobile typecheck
pnpm test:security -- --runTestsByPath tests/security/master-sprint-66.spec.ts tests/security/citizen-pwa-sprint25.spec.ts
graphify update .
```

## Manual Smoke Test

1. Start infra and refresh database state:
   ```bash
   pnpm infra:up
   pnpm --filter @enagar/api prisma:migrate:deploy
   pnpm db:seed
   ```
2. Start API:
   ```bash
   pnpm --filter @enagar/api dev
   ```
3. Confirm the API catalogue returns published form metadata:
   ```bash
   curl http://localhost:3001/api/services/tenants/KMC/birth-cert
   ```
   Expected: JSON includes `form_version_id`, `form_schema.service_code = "birth-cert"`, `fee_config`, and `required_documents`.
4. Start Citizen PWA:
   ```bash
   pnpm --filter @enagar/citizen-pwa dev
   ```
5. Open `http://localhost:3000`, login with dev OTP, pin `KMC`, enter the KMC workspace, open **Services**, and apply for **Birth Certificate**.
6. Confirm the form renders with applicant/child/document fields and submission creates a draft/submitted application.
7. Optional admin propagation smoke: start Tenant Admin, publish a changed draft for a low-risk service, re-open the citizen service, and confirm the form title/version changes without rebuilding the PWA.
8. Optional mobile smoke: start Expo, select `KMC`, open **Services**, apply for **Birth Certificate**, and confirm the native form renders from the API-backed service row.
