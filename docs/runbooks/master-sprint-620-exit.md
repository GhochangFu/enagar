# Master Sprint 6.20 Exit — Citizen Mobile PWA Parity

Status: **closed** — signed off 2026-05-19 (manual smoke Pass). Plan: [`master-sprint-620-plan.md`](./master-sprint-620-plan.md).

**Phase gate:** Phase UX programme **6.14–6.20** complete for citizen surfaces. **Phase 7 (Sahayak AI)** may proceed per [`ROADMAP.md`](../../ROADMAP.md) and [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md).

**Smoke:** Citizen `9836177767`, dev OTP `12345`, API `:3001`, PWA `:3000`, mobile Expo web `:8081` (+ user sign-off on full manual matrix).

## Delivered

- [x] Expo / Metro monorepo foundation (web + native bundle)
- [x] Central citizen hub (tabs, KPIs, pinned ULBs, service shortcuts, shortcuts save)
- [x] Municipality workspace (services, apply, applications, payments, grievances)
- [x] Hub portfolio grievances (`GET /grievances` without ULB scope)
- [x] `applyPlatformTheme` / `applyTenantTheme` parity with PWA
- [x] Mobile visual polish — Tricolor Calm (`citizenMobileTheme.ts`, `MobileChrome`, hub components)
- [x] `tests/security/master-sprint-620.spec.ts`
- [x] Help + mobile README updated

## Non-goals preserved

- No Phase 7 chatbot UI.
- No admin portals on mobile.
- No dark mode.
- Expo SDK 54 upgrade (optional future).

## Verification

```bash
pnpm --filter @enagar/mobile typecheck
pnpm --filter @enagar/mobile lint
pnpm test:security -- --runTestsByPath tests/security/master-sprint-620.spec.ts
graphify update .
```

**2026-05-19 — close sign-off**

| Check                       | Result                   |
| --------------------------- | ------------------------ |
| `@enagar/mobile` typecheck  | Pass                     |
| `master-sprint-620.spec.ts` | Pass                     |
| Manual smoke matrix (#1–12) | **Pass** (product owner) |

## Manual smoke

Evidence (optional): `smoke-620-mobile-hub.png`, `smoke-620-pwa-hub.png` in this folder.

| #   | Scenario                | Result   |
| --- | ----------------------- | -------- |
| 1   | Tenant list loads       | **Pass** |
| 2   | OTP → hub               | **Pass** |
| 3   | Pin + hub KPIs          | **Pass** |
| 4   | Workspace theme         | **Pass** |
| 5   | Apply flow              | **Pass** |
| 6   | Applications            | **Pass** |
| 7   | Payments                | **Pass** |
| 8   | Grievances              | **Pass** |
| 9   | Back to hub             | **Pass** |
| 10  | Shortcuts tab           | **Pass** |
| 11  | PWA side-by-side        | **Pass** |
| 12  | Expo web / device smoke | **Pass** |

## Exit criteria checklist

| #   | Criterion                                | Status  |
| --- | ---------------------------------------- | ------- |
| E1  | Hub matches PWA                          | **Met** |
| E2  | Workspace feature parity                 | **Met** |
| E3  | Theme parity (Tricolor Calm + ULB brand) | **Met** |
| E4  | Dev workflow documented                  | **Met** |
| E5  | typecheck / lint / spec                  | **Met** |
| E6  | No API drift                             | **Met** |
| E7  | Manual smoke Pass                        | **Met** |

## Phase gate

Sprint **6.20** closes **Citizen mobile PWA parity**. **Phase 7 (Sahayak AI)** is unblocked.

**Next:** Phase 7 per [`ROADMAP.md`](../../ROADMAP.md) — Sahayak AI backend + chatbot UI on refreshed citizen surfaces.
