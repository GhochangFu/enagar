# tests/security

**Cross-cutting** security tests that don't belong inside any one app.

## Suites

| File                              | Purpose                                                                         | Phase               |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------- |
| `tenant-isolation.spec.ts`        | Cross-tenant data leak guard (API + Prisma + RLS)                               | 0 (stub) → 1 (real) |
| _planned_ `auth-flow.spec.ts`     | OIDC code-flow integration, token refresh, MFA                                  | 1                   |
| _planned_ `pii-redaction.spec.ts` | Verifies the chatbot redactor catches all PII patterns before any provider call | 7                   |
| _planned_ `rls-fuzz.spec.ts`      | Property-based fuzzer that picks random tenant pairs and asserts isolation      | 6                   |

The Phase-0 stub establishes:

1. The location/convention (every cross-cutting security test lives here).
2. A required CI step (`pnpm run test:security`) that fails the build if anyone deletes or skips this folder by accident.
