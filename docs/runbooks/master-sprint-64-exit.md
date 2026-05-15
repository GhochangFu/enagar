# Master Sprint 6.4 — engineering exit record

**Goal (ROADMAP queue #11):** Tenant Admin notification templates, KB CMS, branding,
feature flags, staff, and role-stage assignments.

## Deliverables shipped in-repo

| Area                   | Artefact                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Settings               | `GET/PATCH /api/admin/tenant/settings` for branding, languages, contact basics, and feature flags         |
| Notification templates | Tenant-scoped `notification_templates` table + `GET/PATCH/POST /api/admin/tenant/notification-templates`  |
| KB CMS                 | Tenant-scoped `kb_articles` table + `GET/PATCH/POST /api/admin/tenant/kb-articles`                        |
| Staff & roles          | `GET/PATCH/POST /api/admin/tenant/staff`, `GET /api/admin/tenant/roles`, and role-stage mapping endpoints |
| Portal UI              | `/dashboard/operations` JSON-editor v1 for settings, templates, KB, staff, and role-stage maps            |
| Seed                   | KMC/HMC smoke templates, KB articles, feature flags, and staff-role rows through `pnpm db:seed`           |
| Tests                  | Admin-tenant service coverage + `tests/security/master-sprint-64.spec.ts`                                 |

## Exit criteria

1. Tenant admin can save/reload branding, enabled languages, and feature flags.
2. Tenant admin can create/update/list notification templates for push/SMS/email/WhatsApp.
3. Invalid template channel/locale/placeholder payloads are rejected before persistence.
4. Tenant admin can create/update/list KB articles and publish/unpublish them.
5. Invalid KB slug/status/body payloads are rejected before persistence.
6. Tenant admin can list staff/roles and create/update tenant-scoped staff role assignments.
7. Tenant admin can map workflow stages to role codes with view/act flags.
8. Existing Sprint 6.1 dashboard, Sprint 6.2 designer, and Sprint 6.3 masters still work.
9. Verification passes: API Prisma validation/build/test, admin typecheck/lint/build, security contracts, and graphify.

## Explicit non-goals / deferrals

- No real SMS/email/WhatsApp/push provider send is performed by Sprint 6.4.
- No Keycloak user provisioning or outbound invite email dispatch is performed by Sprint 6.4.
- KB publish stores DB-ready content only; Qdrant/RAG re-indexing remains Phase 7 integration work.
- Citizen runtime catalogue/form consumption remains Sprint 6.6 catalogue alignment.

## Manual smoke checklist

1. `pnpm --filter @enagar/api prisma:migrate:deploy`
2. `pnpm db:seed`
3. `pnpm --filter @enagar/api dev`
4. `pnpm --filter @enagar/admin-tenant dev`
5. Log in as `kmc-municipality-admin-dummy`.
6. Open `/dashboard/operations`.
7. Save one settings payload, notification template, KB article, and staff role assignment.
8. Reload `/dashboard/operations` and confirm each saved row/value persists.
9. Recheck `/dashboard`, `/dashboard/masters`, and one service **Configure** page.

_Status: closed — engineering (2026-05-15); CI-equivalent scripts verified in-session._
