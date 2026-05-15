# Master Sprint 6.2 — engineering exit record

**Goal (ROADMAP queue #9):** Tenant Admin **Form-Schema Builder** + **Workflow Designer**.

## Deliverables shipped in-repo

| Area              | Artefact                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Forms contract    | `@enagar/forms` adds `createBlankFormSchemaDraft` + `assertValidFormSchema` for builder-safe drafts                     |
| Workflow contract | `@enagar/workflow` adds `createLinearWorkflowDraft`, `validateWorkflowDefinition`, `assertValidWorkflowDefinition`      |
| API               | `AdminTenantModule` adds service designer endpoints under `PATCH/GET /api/admin/tenant/services/:serviceId/...`         |
| Persistence       | Draft/publish flows use existing `service_form_versions`, `workflows`, `workflow_stages`, `workflow_transitions` tables |
| Portal UI         | `apps/admin-tenant/app/dashboard/services/[serviceId]` service designer page                                            |
| Preview           | Citizen form preview renders through `@enagar/forms/web` so admin preview and citizen runtime share one renderer        |
| Tests             | Package contract tests, admin-tenant API unit coverage, `tests/security/master-sprint-62.spec.ts` fingerprints          |

## API surface

- `GET /api/admin/tenant/services/:serviceId/designer`
- `PATCH /api/admin/tenant/services/:serviceId/form-draft`
- `PATCH /api/admin/tenant/services/:serviceId/form-draft/publish`
- `PATCH /api/admin/tenant/services/:serviceId/workflow-draft`
- `PATCH /api/admin/tenant/services/:serviceId/workflow-draft/publish`

All routes remain authenticated and tenant-scoped through the Sprint 6.1 portal RBAC gate.

## Exit criteria

1. Tenant admin can open a service from the catalogue and reach a designer page.
2. Form JSON can be edited, validated, saved as draft, published, and previewed through the web form renderer.
3. Workflow JSON can be edited, validated, saved as draft, and published into normalized workflow tables.
4. Invalid form/workflow definitions are rejected before publish.
5. Published form/workflow rows retire previous published versions for the same tenant service.
6. `pnpm --filter @enagar/forms test`, `pnpm --filter @enagar/workflow test`, `pnpm --filter @enagar/api build`, `pnpm --filter @enagar/admin-tenant build`, and `pnpm test:security` pass.

## Explicit non-goals / deferrals

- Drag-and-drop canvas polish — scheduled **ROADMAP queue #14** (**Sprint 6.7 — designer polish**). The v1 designer uses structured JSON editing with validation and live preview.
- Citizen intake is not yet switched from seed-backed runtime schemas to DB-published `service_form_versions` — scheduled **ROADMAP queue #13** (**Sprint 6.6 — catalogue alignment**).
- Full audit-log persistence for every admin action remains a broader Phase 6 hardening item.
- React Flow / X6 visual graph editing is part of **#14 (6.7)**; publish contracts from this sprint stay unchanged.

## Manual smoke checklist

1. `pnpm infra:up` · `pnpm db:seed` · optional `pnpm infra:seed-keycloak-users`.
2. `pnpm --filter @enagar/api dev`.
3. `pnpm --filter @enagar/admin-tenant dev`.
4. Log in with a tenant-scoped operator.
5. Open `/dashboard`, click **Configure** on a service.
6. Save + publish the starter form draft and starter workflow draft.
7. Confirm reload shows published versions and no validation errors.

_Status: closed — engineering (2026-05-15); CI-equivalent scripts verified in-session._
