# Master Sprint 6.8 Exit — Phase 6 P1 Operator Polish

Status: **closed engineering** pending human acceptance smoke.

## Deliverables

- Added tenant-scoped maintenance / outage banners with `tenant_banners`, RLS, active-window filtering, Tenant Admin CRUD, and public `GET /tenants/:code/banners`.
- Citizen PWA workspace now fetches active banners for the selected municipality and renders severity-aware notices without requiring a client rebuild.
- Extracted service fee/document/revenue configuration from the large service designer into `service-config-panel.tsx`.
- Added guided document checklist rows for code, multilingual label, required flag, accepted MIME types, and max upload size while preserving the existing `required_documents` API contract.
- Added guided fee-rule controls for `free`, `fixed`, `slab`, `computed`, and `external` rules while preserving the existing safe `FeeRule` JSON contract.
- Added Tenant Admin notification-template authoring with channel, locale, trigger, live `{{variable}}` extraction, sample substitution preview, and JSON fallback.
- Security contract `tests/security/master-sprint-68.spec.ts` guards banners, guided config UX, notification preview, and no-provider-send/no-executable-expression invariants.

## Exit Criteria

- Tenant admin can create an active banner and citizens see it in the matching municipal workspace.
- Tenant admin can edit document checklist rows through form controls and save to the existing service config endpoint.
- Tenant admin can configure supported fee rules through guided controls and still see backend fee preview.
- Tenant admin can preview notification placeholders before saving templates.
- Existing Sprint 6.3 and 6.4 server validations remain the source of truth.
- No SMS/email/WhatsApp/push provider sends are introduced.
- `service-designer-client.tsx` and `apps/citizen-pwa/app/page.tsx` do not absorb the bulk of new logic; helpers/components carry the new UI.

## Explicit Non-Goals

- No production notification delivery integration.
- No banner scheduling calendar UI beyond active start/end fields.
- No P2 backlog items: reports, CSV imports, deeper analytics, audit search, or tenant drill-down.
- No rewrite of citizen hub routing or service catalogue runtime contracts.

## Verification Commands

```bash
pnpm --filter @enagar/api prisma:generate
pnpm --filter @enagar/api prisma:validate
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test -- admin-tenant.service.spec.ts tenants.service.spec.ts
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa lint
pnpm test:security -- --runTestsByPath tests/security/master-sprint-68.spec.ts tests/security/master-sprint-63.spec.ts tests/security/master-sprint-64.spec.ts
pnpm test:security
graphify update .
```

## Manual Smoke Test

1. Start infra, migrate, seed, API, Tenant Admin, and Citizen PWA:
   ```bash
   pnpm infra:up
   pnpm --filter @enagar/api prisma:migrate:deploy
   pnpm db:seed
   pnpm --filter @enagar/api dev
   pnpm --filter @enagar/admin-tenant dev
   pnpm --filter @enagar/citizen-pwa dev
   ```
2. Sign into Tenant Admin on `http://localhost:3002` as a KMC/HMC dummy municipality admin.
3. Open **Operations**, create a **Maintenance banner**, save, and refresh Citizen PWA KMC/HMC workspace.
4. Confirm the banner appears below the workspace header with the right severity.
5. Open **Configure** for a low-risk service such as RTI or Community Hall.
6. In guided config, add/edit a document row, save, reload, and confirm persistence.
7. Change the fee rule type, save, reload, and confirm the backend fee preview updates or shows external/invalid when expected.
8. In **Operations**, edit a notification template, add sample values, confirm the live preview, save, reload, and verify the template list updates.
