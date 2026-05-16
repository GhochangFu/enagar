# tests/security

**Cross-cutting** security tests that don't belong inside any one app.

## Suites

| File                               | Purpose                                                                                                                              | Phase      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `tenant-isolation.spec.ts`         | Migration contract for tenant tables, Prisma mappings, and RLS policies                                                              | 1.1        |
| `keycloak-realm.spec.ts`           | Realm export contract for roles, clients, tenant claims, and compose import                                                          | 1.2        |
| `jwt-contract.spec.ts`             | API JWT verification and request tenant-binding contract                                                                             | 1.2        |
| `citizen-onboarding.spec.ts`       | PWA route contract (1.3) + native `navigation/types.ts` flow + thin `CitizenShell` navigator wiring (5.2a Splash → OTP → grievances) | 1.3 / 5.2a |
| `sprint14-security-review.spec.ts` | Security gate for i18n, theming/onboarding, CORS, and blocked DigiLocker status                                                      | 1.4        |
| `service-catalogue.spec.ts`        | API/seed contract for Sprint 2.1 service catalogue layering                                                                          | 2.1        |
| `form-schema.spec.ts`              | Shared form-schema/runtime contract and no service-specific UI guard                                                                 | 2.2        |
| `applications-workflow.spec.ts`    | Protected application APIs, shared form validation, workflow, worker contracts                                                       | 2.3        |
| `documents-holdings.spec.ts`       | Protected document upload and tenant-scoped holding lookup contracts                                                                 | 2.4        |
| `citizen-pwa-sprint25.spec.ts`     | Citizen Services → Apply → My Applications UI contract                                                                               | 2.5        |
| `phase2-hardening.spec.ts`         | Phase 2 protected-route, PWA size, and roadmap hardening contract                                                                    | 2.6        |
| `phase2-closure.spec.ts`           | Final Phase 2 exit-criteria proof for SQL-only service addition and upload order                                                     | 2          |
| `master-sprint-66.spec.ts`         | Phase 6.6 proof that citizen PWA/mobile consume DB-published tenant catalogue/forms instead of bundled form fixtures                 | 6.6        |
| `master-sprint-67.spec.ts`         | Phase 6.7 proof that Tenant Admin designer polish keeps palette/canvas edits on the same draft/publish contracts                     | 6.7        |
| `master-sprint-68.spec.ts`         | Phase 6.8 proof for tenant banners, guided service config, notification previews, and no provider sends                              | 6.8        |
| `master-sprint-69.spec.ts`         | Phase 6.9 proof for tenant dashboard depth, CSV exports/import, state audit search/export, and tenant drill-down                     | 6.9        |
| _planned_ `auth-flow.spec.ts`      | OIDC code-flow integration, token refresh, MFA                                                                                       | 1          |
| _planned_ `pii-redaction.spec.ts`  | Verifies the chatbot redactor catches all PII patterns before any provider call                                                      | 7          |
| _planned_ `rls-fuzz.spec.ts`       | Property-based fuzzer that picks random tenant pairs and asserts isolation                                                           | 6          |

Phase 1 security status:

- `pnpm test:security` covers RLS migration contracts, Keycloak realm shape, JWT tenant binding, PWA/mobile onboarding routes, CORS, i18n, tenant theming, DigiLocker-blocked status, service catalogue, form schema, application APIs, workflow contracts, document upload contracts, holding lookup contracts, the citizen PWA end-to-end UI contract, Phase 2 protected-route/PWA hardening, final Phase 2 SQL-only service/upload-order closure contracts, Phase 6 citizen catalogue alignment, Tenant Admin designer polish, Phase 6 P1 operator polish, and Phase 6 P2 reporting/state visibility.
- `pnpm security:zap:auth` completed with `FAIL-NEW: 0`, `WARN-NEW: 0`, and 119 passing checks for the auth OpenAPI surface.
- Real DigiLocker/Aadhaar linking is intentionally deferred until external access and permission are granted.

The Sprint 1.1 contract establishes:

1. Every Sprint 1.1 table exists in the initial migration and Prisma schema.
2. Every Sprint 1.1 table has RLS enabled.
3. Every table with `tenant_id` has a `tenant_isolation` policy.
4. A required CI step (`pnpm run test:security`) fails the build on RLS drift.
