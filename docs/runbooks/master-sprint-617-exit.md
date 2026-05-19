# Master Sprint 6.17 Exit — Tenant Admin Shell, Dashboard & Desk

Status: **closed** — engineering, verification, and manual smoke signed off (2026-05-19). **Next:** Sprint **6.19** (State Admin + mobile) — [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) §6.19. Plan: [`master-sprint-617-plan.md`](./master-sprint-617-plan.md).

## Delivered

- [x] `TenantAdminShell` — collapsible sidebar, tenant badge, role-aware navigation (`components/tenant-admin-shell.tsx`, `app/dashboard/layout.tsx`)
- [x] Login page — Warm Coral B+ Pro, Keycloak CTA, accessible errors (`app/login/page.tsx`, `components/login-theme.tsx`)
- [x] Dashboard — mint-band KPIs, trend exports via `@enagar/ui` `Button`, breached-queue tiles → Desk (`?docket=` / `?grievance=`)
- [x] Desk — shell integration, `@enagar/ui` buttons, `cache: 'no-store'` preserved
- [x] Session — `TenantAdminSessionProvider`, clerk `/dashboard` → `/dashboard/desk` guard
- [x] Service designer — shared session + network error handling (no unhandled `Failed to fetch`)
- [x] `tests/security/master-sprint-617.spec.ts` (8/8 passing)
- [x] Operator tokens documented via shared B+ Pro / `tricolor-calm.css` (no separate design-system delta required)

## Non-goals preserved

- No Masters / Operations / service designer guided UX (6.18).
- No State Admin or mobile parity (6.19).
- No API route, database migration, workflow, Desk business-rule, or Keycloak realm changes.
- No dark mode.

## Verification

**2026-05-19**

```bash
pnpm --filter @enagar/admin-tenant typecheck   # pass
pnpm --filter @enagar/admin-tenant build       # pass
pnpm test:security -- --runTestsByPath tests/security/master-sprint-617.spec.ts   # 8/8 pass
graphify update .                              # pass
```

## Manual smoke

**Signed Pass** — Tenant Admin (`:3002`), API `:3001`, Citizen PWA `:3000`, Keycloak dummy users ([`keycloak.md`](./keycloak.md)).

| #   | Scenario                                              | Result |
| --- | ----------------------------------------------------- | ------ |
| 1   | Infra, seed, API, Tenant Admin, Keycloak users        | Pass   |
| 2   | Clerk login → Desk landing                            | Pass   |
| 3   | Clerk: application transition + timeline              | Pass   |
| 4   | Clerk: grievance status + comment                     | Pass   |
| 5   | Clerk: Masters/Operations not usable; messaging clear | Pass   |
| 6   | Admin: Dashboard KPIs; breached tile → Desk           | Pass   |
| 7   | Admin: Desk All open, SLA sweep, assign               | Pass   |
| 8   | Admin: CSV/PDF exports visually consistent            | Pass   |
| 9   | Sidebar collapse / layout; sign out from shell        | Pass   |
| 10  | Citizen submit → clerk sees update in Desk            | Pass   |

## Exit criteria checklist

| #   | Criterion                                         | Status   |
| --- | ------------------------------------------------- | -------- |
| E1  | Role-aware `TenantAdminShell` on dashboard + desk | **Pass** |
| E2  | B+ Pro login; no gradients                        | **Pass** |
| E3  | Dashboard breached tiles → Desk                   | **Pass** |
| E4  | Desk polish; `cache: 'no-store'` preserved        | **Pass** |
| E5  | `@enagar/ui` buttons replace `.btn-*` in scope    | **Pass** |
| E6  | No API/auth drift                                 | **Pass** |
| E7  | typecheck / lint / build / security tests         | **Pass** |
| E8  | Manual smoke signed Pass                          | **Pass** |

## Phase gate

Sprint **6.17** closed — unblocks **6.18** (Masters, Operations, designer chrome). Phase 7 remains gated on **6.19** UX sign-off.
