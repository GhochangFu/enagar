# Master Sprint 6.5 Exit — State Super-Admin Portal

Status: **closed engineering** pending human acceptance smoke.

## Deliverables

- `apps/admin-state` is a real Next.js 14 portal on port **3003** with PKCE login via the `admin-state` Keycloak client.
- `AdminStateModule` exposes authenticated state-admin APIs:
  - `GET /api/admin/state/analytics`
  - `GET /api/admin/state/tenants`
  - `PATCH /api/admin/state/tenants`
  - `POST /api/admin/state/impersonation`
  - `GET /api/admin/state/audit-logs`
- Prisma adds `state_audit_logs` and `impersonation_tokens` for audited support actions.
- Tenant onboarding can create/update a municipality and optionally inherit default services.
- Cross-tenant analytics and tenant directory load from database counts.
- Local CORS/env docs include `http://localhost:3003`.

## Exit Criteria

- Only JWTs with `state_admin` may access the state-admin API surface.
- Tenant onboarding validates tenant code, theme color, language list, and active/draft/suspended status.
- Impersonation requires a reason, records an audit event, and creates a 15-minute signed token with a persisted `token_id`.
- State Admin portal can load analytics, tenants, audit logs, save onboarding JSON, and create impersonation tokens.
- Security contract `tests/security/master-sprint-65.spec.ts` covers schema, API, RBAC markers, CORS, and UI markers.

## Explicit Non-Goals

- No live Keycloak user provisioning or municipality operator invitation workflow.
- No production support-session handoff page. This sprint generates the scoped token and audit trail only.
- No global service library curator UX; onboarding inherits the current seeded service library.
- No public transparency report publishing; this sprint keeps analytics inside the state portal.

## Verification Commands

```bash
pnpm --filter @enagar/api prisma:validate
pnpm --filter @enagar/api build
pnpm --filter @enagar/api test
pnpm --filter @enagar/admin-state typecheck
pnpm --filter @enagar/admin-state lint
pnpm --filter @enagar/admin-state build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-65.spec.ts
graphify update .
```

## Manual Smoke Test

1. Start infra and apply migrations/seeds:
   ```bash
   pnpm infra:up
   pnpm --filter @enagar/api prisma:migrate:deploy
   pnpm db:seed
   ```
2. Start API:
   ```bash
   pnpm --filter @enagar/api dev
   ```
3. Start State Admin portal:
   ```bash
   pnpm --filter @enagar/admin-state dev
   ```
4. Open `http://localhost:3003/login` and sign in using a `state_admin` dummy user.
5. Confirm `/dashboard` shows analytics cards and the seeded tenant directory.
6. In **Tenant onboarding wizard JSON**, keep the default `NBM` payload and click **Save tenant**.
7. Confirm `NBM` appears in the tenant directory with active status and inherited services.
8. In **Audited impersonation**, set tenant code `KMC`, enter a support reason, and click **Create 15-minute token**.
9. Confirm the status message shows a token id and expiry time.
10. Confirm **Recent audit log** contains `tenant.upsert` and `impersonation.create` entries.
