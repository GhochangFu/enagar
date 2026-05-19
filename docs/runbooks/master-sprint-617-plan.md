# Master Sprint 6.17 Plan — Tenant Admin Shell, Dashboard & Desk

Status: **closed** — signed off 2026-05-19. Exit: [`master-sprint-617-exit.md`](./master-sprint-617-exit.md).

**Parent programme:** [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) §6.17 · **Phase UX operator pass** · **Gate before Phase 7.**

**Prerequisite:** Sprint **6.16** closed (Citizen PWA B+ Pro). Sprint **6.13** Desk APIs and clerk flows remain the functional baseline.

## Goal

Deliver a **professional operator workstation** on Tenant Admin (`:3002`): shared Warm Coral shell, role-aware navigation, polished login, dashboard KPIs that deep-link into Desk, and clerk-first Desk chrome — **without changing API routes, Desk semantics, auth, or workflow rules**.

## Design direction

- **Tone:** Warm Coral **B+ Pro** (same tokens as Citizen PWA) — warm white canvas `#FAF7F4`, burnt primary `#BF4A0A`, forest/sage for KPI bands and secondary actions, peach accent-only. Solid surfaces; **no gradients** on shell/login/dashboard/Desk chrome.
- **Operator vs citizen:** denser layout, sidebar navigation, data tables and split-pane Desk preserved from 6.13.
- **Tenant brand:** `applyTenantTheme(tenant)` from JWT `tenant_code` / dashboard snapshot on authenticated routes; platform burnt orange when tenant colour not yet loaded.
- **Primitives:** prefer `@enagar/ui` (`Button`, `Card`, `Badge`, `PageHeader`, `StatCard`, `Icon`) over ad-hoc `.btn-primary` / `.btn-secondary` in `globals.css`.

## Deliverables

### D1 — Shared operator shell (`TenantAdminShell`)

| Item           | Acceptance                                                                                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout wrapper | New component(s) under `apps/admin-tenant/components/` used by `/dashboard/*` routes (dashboard, desk, and read-only nav to masters/operations/services).                                                                                                                                                                          |
| Sidebar        | Collapsible on desktop; compact / drawer pattern on narrow viewports; persistent tenant badge (code + optional name from dashboard or desk `/me`).                                                                                                                                                                                 |
| Role-aware nav | **Clerk** (`tenant_clerk`, `municipality_clerk`): Desk-first nav — Desk prominent; Masters/Operations/Service designer hidden or disabled with clear “Admin only” affordance. **Admin** (`tenant_admin`, `municipality_admin`, `state_admin`): full nav (Dashboard, Desk, Masters, Operations, Services catalogue entry as today). |
| User menu      | Sign out, session status; optional “Refresh” at shell level where appropriate.                                                                                                                                                                                                                                                     |
| Header         | Page title slot + breadcrumb or section label; no duplicate sign-out rows on every page.                                                                                                                                                                                                                                           |

### D2 — Login & auth chrome

| Item         | Acceptance                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Login page   | `/login` matches citizen-grade calm: `bg-canvas`, white card, sage badge, burnt CTA to Keycloak; operator-facing copy (not dev-jargon primary). |
| Error states | Keycloak `?error=` surfaced in accessible alert; focus rings on CTA.                                                                            |
| Branding     | PWA manifest/theme optional follow-up; page uses platform tokens from `tricolor-calm.css`.                                                      |

### D3 — Dashboard UX

| Item                    | Acceptance                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI strip               | Six snapshot KPIs in `StatCard` / mint-band styling; forest numerals; readable at 1280px and stacked on tablet.                                                 |
| Trends block            | 30-day application/payment trends styled consistently (no raw unstyled tables only).                                                                            |
| Breached queues         | Grievance/application breach lists as **clickable tiles** → navigate to Desk with sensible default tab/filter (query param or in-app state documented in exit). |
| Exports                 | CSV/PDF export controls use `@enagar/ui` `Button` variants; visually grouped; behavior unchanged.                                                               |
| Service catalogue table | Row actions (Configure, SLA draft) remain functional; table density improved, not re-platformed to Masters (6.18).                                              |

### D4 — Desk UX (clerk-first)

| Item              | Acceptance                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Shell integration | Desk uses `TenantAdminShell`; remove duplicate top nav that repeats Dashboard/Masters/Operations links.                     |
| Inbox density     | Application and grievance lists scannable: reference, status chips, SLA hints, selected-row highlight.                      |
| Detail panel      | Timeline / comments / actions hierarchy clear; primary workflow actions use burnt CTA; secondary actions forest or outline. |
| Tabs              | Applications vs grievances tab switch uses shared button styles (not only `.btn-primary`).                                  |
| Data freshness    | All Desk `fetch` calls retain `cache: 'no-store'` (6.13 contract).                                                          |
| Admin actions     | SLA sweep, assign, transitions, comments — unchanged API paths; buttons styled consistently.                                |

### D5 — Global styling cleanup

| Item                  | Acceptance                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Remove ad-hoc buttons | Replace `.btn-primary` / `.btn-secondary` usage in `desk-client.tsx`, `dashboard-client.tsx`, and other 6.17-scoped files with `@enagar/ui` `Button`.                                |
| `globals.css`         | Keep token import; deprecate or narrow `.btn-*` layer to Storybook-only if unused.                                                                                                   |
| Ink tokens            | Prefer `text-ink-*`, `border-warm-border`, `bg-surface`, `bg-mint-band` over raw `slate-*` on shell/dashboard/desk chrome (full slate purge deferred to 6.18 on Masters/Operations). |

### D6 — Clerk redirect & 6.13 regression safety

| Item                 | Acceptance                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Dashboard 403 → Desk | Clerk-only users hitting config APIs still redirect to `/dashboard/desk` (existing logic preserved). |
| Desk APIs            | No changes to `/admin/tenant/desk/*` request/response shapes.                                        |

### D7 — Contracts & documentation

| Item          | Acceptance                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Security spec | `tests/security/master-sprint-617.spec.ts` — no API drift, shell/nav/desk UX contracts, Phase 7 gate note.            |
| Exit runbook  | `master-sprint-617-exit.md` updated through verification and manual smoke.                                            |
| App README    | `apps/admin-tenant/README.md` — Sprint 6.17 section with smoke pointer.                                               |
| Design system | Short delta in `docs/design-system.md` for **operator shell** (sidebar, desk density) if new patterns are introduced. |

## Non-goals

- **Masters, Operations, service designer** layout overhaul — Sprint **6.18**.
- **State Admin** (`:3003`) — Sprint **6.19**.
- **Citizen PWA / mobile** changes except shared token file already in `@enagar/config`.
- New APIs, DB migrations, workflow JSON changes, Desk business rules, or Keycloak realm changes.
- Real-time push, dark mode, i18n key rewrites.
- Replacing `@xyflow/react` designer graph logic.

## Expected file touches (indicative)

- `apps/admin-tenant/components/tenant-admin-shell.tsx` (and related nav/sidebar modules)
- `apps/admin-tenant/app/dashboard/layout.tsx` (or equivalent shared layout)
- `apps/admin-tenant/app/login/page.tsx`
- `apps/admin-tenant/app/dashboard/dashboard-client.tsx`
- `apps/admin-tenant/app/dashboard/desk/desk-client.tsx`
- `apps/admin-tenant/app/globals.css`
- `tests/security/master-sprint-617.spec.ts`
- `docs/runbooks/master-sprint-617-exit.md`

## Verification

```bash
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-617.spec.ts
pnpm test:security
graphify update .
```

Optional: axe spot-check on `/login`, `/dashboard`, `/dashboard/desk` (WCAG AA target per phase plan).

## Manual smoke

Re-run **Sprint 6.13 Desk scenarios** on new chrome (local stack: API `:3001`, Tenant Admin `:3002`, Citizen PWA `:3000`, Keycloak dummy users per [`keycloak.md`](./keycloak.md)).

| #   | Scenario                                                                                                 | Roles                          |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Infra up, migrate, seed, API, Tenant Admin, Keycloak dummy users                                         | —                              |
| 2   | **Clerk** login → lands on **Desk** (not blocked on dashboard config)                                    | `kmc-tenant-clerk-dummy`       |
| 3   | Clerk: application in **My queue** → open dossier → workflow transition + timeline                       | clerk                          |
| 4   | Clerk: grievance → status update + comment                                                               | clerk                          |
| 5   | Clerk: nav does **not** expose Masters/Operations as working destinations; blocked state clear if linked | clerk                          |
| 6   | **Admin** login → **Dashboard** KPIs load; breached tile opens Desk context                              | `kmc-municipality-admin-dummy` |
| 7   | Admin: Desk **All open**, SLA sweep, assign (when staff seeded)                                          | admin                          |
| 8   | Admin: CSV + PDF export buttons work and look consistent with shell                                      | admin                          |
| 9   | Sidebar collapse / 1280px layout usable; sign out works from shell                                       | both                           |
| 10  | Citizen PWA regression: submit application + grievance; clerk sees updates in Desk                       | citizen + clerk                |

Password: `DummyDev_2026!ChangeMe` (or `KEYCLOAK_DUMMY_USER_PASSWORD`). Citizen dev OTP: `12345` when `DEV_AUTH_ENABLED`.

## Exit criteria

Engineering and manual smoke must all pass before setting plan/exit status to **closed**.

| #   | Criterion                                                           | Evidence                             |
| --- | ------------------------------------------------------------------- | ------------------------------------ |
| E1  | `TenantAdminShell` wraps dashboard and desk with role-aware sidebar | Code review + smoke #5, #9           |
| E2  | Login page uses B+ Pro tokens; no gradient backgrounds              | Visual + `master-sprint-617.spec.ts` |
| E3  | Dashboard KPIs and breached-queue tiles deep-link to Desk           | Smoke #6                             |
| E4  | Desk inbox/detail polished; `cache: 'no-store'` preserved           | Code grep + smoke #3–4, #7           |
| E5  | `.btn-primary` / `.btn-secondary` replaced in 6.17-scoped surfaces  | Grep + spec                          |
| E6  | No API route, DB, workflow, or auth contract changes                | Spec + API diff discipline           |
| E7  | `typecheck`, `lint`, `build`, `test:security` green                 | CI / local commands                  |
| E8  | Manual smoke table in exit doc signed **Pass**                      | `master-sprint-617-exit.md`          |

## Phase gate

Sprint **6.17** unblocks **6.18** (Masters, Operations, designer chrome). Phase 7 remains gated on **6.19** UX sign-off.
