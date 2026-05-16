# Master Sprint 6.12 Exit — Phase 6 P5 Identity, Library, Integrations, and Hardening

Status: **closed engineering — 2026-05-16**. Manual smoke: **passed** (operator sign-off).

## Delivered

- Tenant Admin Operations now supports guided staff invite/provisioning records through `staff_invites`, with tenant scope, dry-run/local-Keycloak readiness metadata, retry/mark-provisioned/disable actions, and audited invite/role-map events.
- State Admin now includes a global service library curator over `global_services` lifecycle metadata, with draft/update, preview, publish, and deprecate controls that do not mutate tenant overrides destructively.
- State Admin now includes an integration cockpit backed by metadata-only `state_integrations`, safe readiness checks, CSV export, and secret-like value rejection.
- Sprint 6.12 hardening adds an audit coverage matrix endpoint plus active-tenant onboarding guardrails requiring wizard-origin completion metadata.
- Security contracts now cover staff invite safety, global library lifecycle semantics, integration metadata-only behavior, audit coverage, and onboarding guardrails.

## Non-Goals Preserved

- No production Keycloak admin write client or password/secret persistence.
- No live DigiLocker, PSP, SMS, email, WhatsApp, object-storage, or RAG worker credential handling.
- No automatic migration of tenant services when global templates change.
- No SIEM pipeline, immutable ledger, or universal historical audit retrofit.

## Verification

Completed:

```bash
pnpm --filter @enagar/api prisma:generate
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-state typecheck
pnpm --filter @enagar/api test -- admin-tenant.service.spec.ts admin-state.service.spec.ts
pnpm test:security -- --runTestsByPath tests/security/master-sprint-612.spec.ts tests/security/master-sprint-611.spec.ts tests/security/master-sprint-610.spec.ts
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/admin-state lint
pnpm --filter @enagar/admin-state build
pnpm test:security
graphify update .
```

## Manual Smoke

Operator sign-off: **passed** (2026-05-16).

1. Sign into Tenant Admin as a KMC/HMC municipality admin and open Operations.
2. Create a guided staff invite in dry-run mode; confirm it appears in the Staff list and audit search.
3. Retry, mark provisioned, and disable the invite; confirm status transitions remain tenant-scoped.
4. Sign into State Admin and save a draft global service template.
5. Publish and deprecate that template; confirm tenant adoption counts are informational only.
6. Save DigiLocker/PSP/SMS metadata in the integration cockpit and run readiness checks.
7. Attempt to include a secret-like field in integration metadata and confirm the API rejects it.
8. Save an active tenant without wizard completion metadata and confirm onboarding guardrails block it.
9. Search/export audit logs for `staff_invite.*`, `global_library.*`, and `integration_cockpit.*`.
