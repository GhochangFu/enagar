# tests/security

**Cross-cutting** security tests that don't belong inside any one app.

## Suites

| File                               | Purpose                                                                         | Phase |
| ---------------------------------- | ------------------------------------------------------------------------------- | ----- |
| `tenant-isolation.spec.ts`         | Migration contract for tenant tables, Prisma mappings, and RLS policies         | 1.1   |
| `keycloak-realm.spec.ts`           | Realm export contract for roles, clients, tenant claims, and compose import     | 1.2   |
| `jwt-contract.spec.ts`             | API JWT verification and request tenant-binding contract                        | 1.2   |
| `citizen-onboarding.spec.ts`       | PWA/mobile onboarding route contract for Splash → Tenant picker → Empty Home    | 1.3   |
| `sprint14-security-review.spec.ts` | Security gate for i18n, theming/onboarding, CORS, and blocked DigiLocker status | 1.4   |
| `service-catalogue.spec.ts`        | API/seed contract for Sprint 2.1 service catalogue layering                     | 2.1   |
| `form-schema.spec.ts`              | Shared form-schema/runtime contract and no service-specific UI guard            | 2.2   |
| `applications-workflow.spec.ts`    | Protected application APIs, shared form validation, workflow, worker contracts  | 2.3   |
| _planned_ `auth-flow.spec.ts`      | OIDC code-flow integration, token refresh, MFA                                  | 1     |
| _planned_ `pii-redaction.spec.ts`  | Verifies the chatbot redactor catches all PII patterns before any provider call | 7     |
| _planned_ `rls-fuzz.spec.ts`       | Property-based fuzzer that picks random tenant pairs and asserts isolation      | 6     |

Phase 1 security status:

- `pnpm test:security` covers RLS migration contracts, Keycloak realm shape, JWT tenant binding, PWA/mobile onboarding routes, CORS, i18n, tenant theming, DigiLocker-blocked status, service catalogue, form schema, application APIs, and workflow contracts.
- `pnpm security:zap:auth` completed with `FAIL-NEW: 0`, `WARN-NEW: 0`, and 119 passing checks for the auth OpenAPI surface.
- Real DigiLocker/Aadhaar linking is intentionally deferred until external access and permission are granted.

The Sprint 1.1 contract establishes:

1. Every Sprint 1.1 table exists in the initial migration and Prisma schema.
2. Every Sprint 1.1 table has RLS enabled.
3. Every table with `tenant_id` has a `tenant_isolation` policy.
4. A required CI step (`pnpm run test:security`) fails the build on RLS drift.
