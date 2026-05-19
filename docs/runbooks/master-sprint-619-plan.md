# Master Sprint 6.19 Plan — State Admin & Cross-Portal Finish

Status: **closed** — signed off 2026-05-19. Exit: [`master-sprint-619-exit.md`](./master-sprint-619-exit.md). **Mobile** → Sprint **6.20**.

**Parent programme:** [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) §6.19 · **Phase UX final operator/citizen pass**.

**Prerequisite:** Sprint **6.18** closed (Tenant Admin Masters, Operations, designer, Desk polish).

## Goal

Deliver **State Admin** (`:3003`) visual parity with the Phase UX system — platform **teal** accent (distinct from tenant Warm Coral), executive dashboard chrome, and shared primitives — plus **mobile** theme alignment and **cross-portal** polish. **No API, auth contract, or business-rule changes.**

## Design direction

- **State vs tenant:** Same canvas/surface/ink tokens (`tricolor-calm.css`); primary CTAs use **platform teal** `#0E7490` via `applyStateAdminTheme()` — not burnt orange.
- **Tone:** Executive, data-dense; cooler accent than ULB operator portal; **no gradients** on shell/login/dashboard chrome.
- **Primitives:** `@enagar/ui` `Button`, `PageHeader`, `Icon`; `@enagar/tenant-theme` for runtime accent.
- **Mobile:** `apps/mobile` — hub/picker/OTP shell uses platform + tenant theme hooks aligned to 6.14 tokens.

## Deliverables

### D1 — State Admin platform theme & dependencies

| Item     | Acceptance                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Packages | `admin-state` depends on `@enagar/ui`, `@enagar/tenant-theme`; `next.config` transpiles workspace packages. |
| Theme    | `applyStateAdminTheme()` sets teal `--brand-rgb` / `--platform-accent-rgb` on `:root`.                      |
| Globals  | `tricolor-calm.css` imported; body uses canvas/ink tokens.                                                  |

### D2 — State Admin login & shell

| Item   | Acceptance                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------- |
| Login  | `/login` — calm card, teal primary CTA, accessible Keycloak errors; no legacy indigo/slate-only chrome. |
| Shell  | `StateAdminShell` — top bar with statewide label, sign out; dashboard routes wrapped.                   |
| Unauth | Signed-out dashboard prompt uses `@enagar/ui` buttons.                                                  |

### D3 — State dashboard executive chrome (`state-dashboard-client.tsx`)

| Item            | Acceptance                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Page chrome     | `PageHeader` — statewide operations title + refresh/sign-out affordances in shell.                                                        |
| KPI strip       | Stat-style cards: `border-warm-border`, `bg-surface`, `text-ink-*`, forest numerals.                                                      |
| Sections        | Tenant directory, audit filters, integration cockpit, onboarding JSON — cards use warm tokens (no bare `slate-*` / `indigo-*` on chrome). |
| Primary actions | All primary saves/exports use `@enagar/ui` `Button` (no `bg-indigo-700` / `bg-slate-900`).                                                |
| APIs unchanged  | All `/admin/state/*` fetch paths and payloads preserved.                                                                                  |

### D4 — Mobile parity (`apps/mobile`)

| Item    | Acceptance                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| Theme   | `applyPlatformTheme` on hub/auth; `applyTenantTheme` when municipality selected.                                   |
| Screens | Home, tenant picker, OTP login — canvas/surface/brand tokens visible; no orphan hard-coded hex unrelated to theme. |
| Scope   | Visual only; no navigation or API changes.                                                                         |

### D5 — Cross-portal polish (scoped)

| Item               | Acceptance                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Focus              | Visible focus rings on primary CTAs in state + mobile touched files.                                 |
| Empty/error        | Reuse or align copy/styling with `@enagar/ui` patterns where trivial in 6.19 scope.                  |
| Print              | Optional: audit CSV / export pages print-friendly (`@media print`) on state dashboard if low effort. |
| Citizen spot-check | No regression to 6.16 B+ Pro (smoke #10).                                                            |

### D6 — Contracts & documentation

| Item          | Acceptance                                                                   |
| ------------- | ---------------------------------------------------------------------------- |
| Security spec | `tests/security/master-sprint-619.spec.ts` — plan/exit, no state API drift.  |
| Exit runbook  | `master-sprint-619-exit.md` through verification and manual smoke.           |
| README        | `apps/admin-state/README.md` — 6.19 in progress.                             |
| Help          | `docs/help/start-the-app-step-by-step.md` — note state port `:3003` UX pass. |

## Non-goals

- New state APIs, DB migrations, Keycloak realm changes, or impersonation semantics.
- Full slate purge in every legacy JSON `<textarea>` block (dark mono blocks OK for JSON).
- Dark mode, i18n key rewrites, Phase 7 Sahayak AI.
- Sprint 6.20 performance/i18n matrix unless pulled in explicitly.

## Expected file touches (indicative)

- `packages/tenant-theme/src/index.ts`
- `apps/admin-state/**` (login, shell, dashboard client, layout, `next.config.mjs`, `package.json`)
- `apps/mobile/src/**` (theme on shell/screens)
- `tests/security/master-sprint-619.spec.ts`
- `docs/runbooks/master-sprint-619-*.md`

## Verification

```bash
pnpm --filter @enagar/admin-state typecheck
pnpm --filter @enagar/admin-state build
pnpm --filter @enagar/mobile typecheck
pnpm test:security -- --runTestsByPath tests/security/master-sprint-619.spec.ts
graphify update .
```

## Manual smoke

Local stack: API `:3001`, State Admin `:3003`, Tenant Admin `:3002`, Citizen `:3000`. Password: `DummyDev_2026!ChangeMe`.

| #   | Scenario                                                    | Roles                          |
| --- | ----------------------------------------------------------- | ------------------------------ |
| 1   | Infra + State Admin `:3003` up                              | —                              |
| 2   | State login — teal CTA, Keycloak, dashboard loads           | `sddm-state-admin-dummy`       |
| 3   | KPI strip + analytics v2 + tenant directory table readable  | state admin                    |
| 4   | Tenant row drill-down + impersonation flow (if seed allows) | state admin                    |
| 5   | Audit log filters + CSV export                              | state admin                    |
| 6   | Integration cockpit + global service library sections load  | state admin                    |
| 7   | Mobile: hub + tenant picker + OTP shell themed              | —                              |
| 8   | Citizen PWA spot-check — hub/workspace still B+ Pro         | —                              |
| 9   | Tenant admin spot-check — Desk + Masters still 6.18 UX      | `kmc-municipality-admin-dummy` |

## Exit criteria

| #   | Criterion                                                            | Evidence                    |
| --- | -------------------------------------------------------------------- | --------------------------- |
| E1  | State uses teal platform theme + shell + PageHeader                  | Code + smoke #2–3           |
| E2  | Dashboard sections use B+ Pro / ink tokens; no indigo primary chrome | Code + smoke #3–6           |
| E3  | Mobile theme hooks on hub/picker/OTP                                 | Code + smoke #7             |
| E4  | No `/admin/state/*` API drift                                        | Spec                        |
| E5  | typecheck / build / security tests green                             | CI / local                  |
| E6  | Citizen + tenant admin regression spot-check                         | Smoke #8–9                  |
| E7  | Manual smoke Pass                                                    | `master-sprint-619-exit.md` |

## Phase gate

Sprint **6.19** closes **State Admin + web cross-portal** UX. **Phase 7** remains gated on **Sprint 6.20** (Citizen mobile PWA parity) — see [`master-sprint-620-plan.md`](./master-sprint-620-plan.md).
