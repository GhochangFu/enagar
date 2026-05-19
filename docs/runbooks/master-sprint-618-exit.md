# Master Sprint 6.18 Exit — Tenant Admin Masters, Operations & Designer Chrome

Status: **closed** — engineering, verification, and manual smoke signed off (2026-05-19). **Next:** Sprint **6.19** (State Admin & cross-portal finish) — [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) §6.19. Plan: [`master-sprint-618-plan.md`](./master-sprint-618-plan.md).

## Delivered

- [x] Masters — section tabs, `PageHeader`, B+ Pro tokens, `@enagar/ui` buttons, shared session
- [x] Masters **6.18b** — list **Edit** / **New** for revenue, tariffs, address; guided address/tariff; `JsonFallbackPanel` only (no inline JSON)
- [x] Operations — `PageHeader`, shared session, section tabs, guided forms for settings/branding/bookings/staff
- [x] Operations **6.18b** — list-driven edit; `JsonFallbackPanel`; removed inline `OperationsEditor` JSON blocks
- [x] Desk — application detail shows guided field summary; JSON in collapsible fallback only; B+ Pro panel tokens
- [x] Masters catalogue — B+ Pro cards, source badges (global / override / tenant-only / forked), ink/warm tokens
- [x] Operations banner/template save buttons — `@enagar/ui` primary (no legacy `bg-slate-900`)
- [x] Service designer — `PageHeader`, publish bar on draft panels, catalogue link
- [x] `AdminOnlyPanel` + `ConfigureRouteGuard` for clerk on configure URLs
- [x] `.btn-*` removed from scoped clients; `globals.css` legacy layer removed
- [x] `tests/security/master-sprint-618.spec.ts` (7/7 passing)

## Non-goals preserved

- No State Admin or mobile parity (6.19).
- No API route, database migration, workflow graph logic, Desk business-rule, or Keycloak realm changes.
- No dark mode.

## Verification

```bash
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-618.spec.ts
graphify update .
```

**2026-05-19 (6.18 initial)**

```bash
pnpm --filter @enagar/admin-tenant typecheck   # pass
pnpm --filter @enagar/admin-tenant build       # pass
pnpm test:security -- --runTestsByPath tests/security/master-sprint-618.spec.ts   # 7/7 pass
```

**2026-05-19 (6.18b configure UX + desk/catalogue polish)**

```bash
pnpm --filter @enagar/admin-tenant typecheck   # pass
pnpm test:security -- --runTestsByPath tests/security/master-sprint-618.spec.ts   # 7/7 pass
```

## Manual smoke

Signed off **Pass** (2026-05-19) — admin configure path, clerk blocked URLs, Desk regression.

| #   | Scenario                                                                              | Result |
| --- | ------------------------------------------------------------------------------------- | ------ |
| 1   | Infra, API, Tenant Admin up                                                           | Pass   |
| 2   | Admin Masters: list edit revenue/tariff/address; guided save; JSON fallback collapsed | Pass   |
| 3   | Admin Masters: catalogue adopt/fork                                                   | Pass   |
| 4   | Admin Operations: section tabs; settings + banner list edit                           | Pass   |
| 5   | Admin Operations: branding/booking guided + staff invite + role-stage                 | Pass   |
| 6   | Admin designer: palette + publish bar + form draft                                    | Pass   |
| 7   | Admin designer: workflow canvas unchanged                                             | Pass   |
| 8   | Clerk `/dashboard/masters` → Admin only                                               | Pass   |
| 9   | Clerk operations + service URL blocked                                                | Pass   |
| 10  | Clerk Desk regression                                                                 | Pass   |

## Exit criteria checklist

| #   | Criterion                                           | Status |
| --- | --------------------------------------------------- | ------ |
| E1  | Masters shell + section nav + B+ Pro                | Pass   |
| E2  | Operations shell + section cards + B+ Pro           | Pass   |
| E3  | Designer chrome; graph logic unchanged              | Pass   |
| E4  | Clerk admin-only UI intentional                     | Pass   |
| E5  | No `.btn-*` in 6.18 scope                           | Pass   |
| E6  | Shared `useTenantAdminSession` on configure clients | Pass   |
| E7  | No API/auth drift                                   | Pass   |
| E8  | typecheck / lint / build / security tests           | Pass   |
| E9  | Manual smoke Pass                                   | Pass   |

## Phase gate

Sprint **6.18** is **closed**. Sprint **6.19** is **closed** (web portals). Phase 7 is gated on Sprint **6.20** (Citizen mobile PWA parity).
