# Master Sprint 6.3 — engineering exit record

**Goal (ROADMAP queue #10):** Tenant Admin fee rules, document checklists, tax/tariff
master, address master, and revenue heads.

## Deliverables shipped in-repo

| Area           | Artefact                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Fee rules      | Safe declarative fee-rule validation + preview (`free`, `fixed`, `slab`, `computed`, `external`)                    |
| Service config | `GET/PATCH /api/admin/tenant/services/:serviceId/config` for fee rule, document checklist, and revenue-head mapping |
| Revenue heads  | `GET/PATCH/POST /api/admin/tenant/revenue-heads` for GL mapping maintenance                                         |
| Address master | `GET/PATCH/POST /api/admin/tenant/address-master`, backed by boroughs, wards, localities, and mouza                 |
| Tariff master  | Tenant-scoped `tenant_tariffs` table + `GET/PATCH/POST /api/admin/tenant/tariffs`                                   |
| Portal UI      | Service designer config panel + `/dashboard/masters` for revenue, address, and tariff rows                          |
| Seed           | Local KMC/HMC address + tariff master smoke data through `pnpm db:seed`                                             |
| Tests          | Admin-tenant service tests + `tests/security/master-sprint-63.spec.ts`                                              |

## Exit criteria

1. Tenant admin can configure fee rule, document checklist, and revenue-head mapping for a service.
2. Tenant admin can create/update/list address master and tax/tariff master rows.
3. Invalid fee rules, document definitions, revenue head codes, and tariff categories are rejected.
4. Master rows remain tenant-scoped; service config remains scoped to the JWT tenant.
5. Existing Sprint 6.1 dashboard and Sprint 6.2 form/workflow designer continue to work.
6. Verification passes: API build/test, admin-tenant typecheck/lint, security contracts, and graphify.

## Explicit non-goals / deferrals

- Citizen intake still does not consume DB-published form/config as its primary runtime source.
- Full CSV bulk import for address master is deferred; v1 uses structured JSON upserts.
- Production-grade audit logging for every admin action remains a broader Phase 6 hardening item.
- PSP integration for external fee providers remains deferred with Sprint 3.1B.

## Manual smoke checklist

1. `pnpm --filter @enagar/api prisma:migrate:deploy`
2. `pnpm db:seed`
3. `pnpm --filter @enagar/api dev`
4. `pnpm --filter @enagar/admin-tenant dev`
5. Log in as `kmc-municipality-admin-dummy`.
6. Open `/dashboard`, click **Configure** on a service, save fee/document/revenue config.
7. Open `/dashboard/masters`, save one revenue head, one address row, and one tariff row.
8. Reload both pages and confirm values persist.

_Status: closed — engineering (2026-05-15); CI-equivalent scripts verified in-session._
