# Master Sprint 6.18 Plan — Tenant Admin Masters, Operations & Designer Chrome

Status: **closed** — signed off 2026-05-19. Exit: [`master-sprint-618-exit.md`](./master-sprint-618-exit.md). **Next:** Sprint **6.19**.

**Parent programme:** [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) §6.18 · **Phase UX operator pass**.

**Prerequisite:** Sprint **6.17** closed (`TenantAdminShell`, dashboard, Desk, B+ Pro login, shared session).

## Goal

Make **Masters**, **Operations**, and the **service designer** feel guided and on-brand (Warm Coral **B+ Pro**) — sectioned layouts, consistent `@enagar/ui` controls, no duplicate top nav — while preserving all configure APIs, CSV import, catalogue governance, and `@xyflow/react` workflow graph behaviour.

## Design direction

- **Tone:** Same B+ Pro tokens as 6.17 — `bg-canvas`, `bg-surface`, `bg-mint-band`, `text-ink-*`, `border-warm-border`, burnt primary CTAs. **No gradients** on config chrome.
- **Layout:** `PageHeader` per surface; **tabbed or sticky section nav** on Masters (revenue, tariffs, address, catalogue); **card sections** on Operations (settings, templates, KB, branding, staff).
- **Session:** `useTenantAdminSession()` on all three clients — remove duplicate `readStoredAuth` / per-page sign-out rows.
- **Clerk:** Shell nav already disables Masters/Operations; add **route guard** + in-page **Admin only** panel when a clerk deep-links or receives 403 — never raw API error strings as the only affordance.

## Deliverables

### D1 — Masters guided UX (`masters-client.tsx`)

| Item           | Acceptance                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Shell          | No duplicate “Back to dashboard” header row; content inside `TenantAdminShell` only.                                                    |
| Page chrome    | `PageHeader` — title “Masters”, subtitle with tenant context.                                                                           |
| Section nav    | Tabs or sticky sub-nav: **Revenue heads** · **Tariffs** · **Address master** · **Catalogue governance** (existing blocks, reorganized). |
| Guided forms   | Preserve Sprint **6.10** guided revenue + tariff flows and JSON fallback editors.                                                       |
| Tables         | Revenue/tariff/address/catalogue lists use `border-warm-border`, `bg-surface`, ink text — no bare `slate-*` on chrome.                  |
| Buttons        | `@enagar/ui` `Button` for save/import/catalogue actions.                                                                                |
| APIs unchanged | `GET/PATCH/POST` revenue-heads, tariffs, address-master, import-csv, catalogue adopt/fork/deactivate.                                   |

### D2 — Operations guided UX (`operations-client.tsx`)

| Item             | Acceptance                                                                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell            | Remove duplicate Masters/Refresh top bar; use shell sign-out.                                                                                                                                                  |
| Page chrome      | `PageHeader` — “Operations” with tenant code subtitle.                                                                                                                                                         |
| Sections         | Card layout for: **Banners** · **Settings / branding / flags** · **Notification templates** · **KB articles** · **Branding assets** · **Bookings** · **Staff & invites** (existing editors, visually grouped). |
| Save affordances | Primary save actions visible per section (sticky footer or section header actions); status banner consistent with dashboard.                                                                                   |
| Buttons          | `@enagar/ui` `Button` throughout.                                                                                                                                                                              |
| APIs unchanged   | `settings`, `banners`, `notification-templates`, `kb-articles`, `branding-assets`, `bookings`, `staff`, `staff-invites`, `roles`.                                                                              |

### D3 — Service designer chrome (`service-designer-client.tsx`, `service-config-panel.tsx`)

| Item           | Acceptance                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page chrome    | `PageHeader` with service code/name; link back to dashboard catalogue (not a second sidebar).                                                                |
| Toolbar        | Form **palette** and workflow tools in a bordered toolbar (`bg-surface`); publish/save actions in a **publish bar** (form + workflow draft/publish grouped). |
| Preview        | Form preview panel framed with warm border; config/fee/documents panel matches B+ Pro.                                                                       |
| Graph          | **No changes** to `@xyflow/react` node/edge building, validation, or transition editing logic.                                                               |
| Network        | All designer `fetch` retain try/catch user messaging (6.17 follow-up).                                                                                       |
| APIs unchanged | `designer`, `config`, form-draft, workflow-draft, publish endpoints.                                                                                         |

### D4 — Clerk & admin-only route guard

| Item           | Acceptance                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client guard   | Extend dashboard layout guard: non-admin on `/dashboard/masters`, `/dashboard/operations`, `/dashboard/services/*` sees **`AdminOnlyPanel`** (explain + link to Desk) — optional redirect to Desk for clerks. |
| API 403        | If configure API returns 403, show same panel — not only `status` string.                                                                                                                                     |
| Desk unchanged | Clerks still use Desk; no regression to 6.13 flows.                                                                                                                                                           |

### D5 — Global styling cleanup

| Item                  | Acceptance                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove `.btn-*` usage | Zero `btn-primary` / `btn-secondary` in `masters-client.tsx`, `operations-client.tsx`, `service-designer-client.tsx`, `service-config-panel.tsx`. |
| `globals.css`         | Remove or comment `.btn-primary` / `.btn-secondary` if no remaining references in admin-tenant.                                                   |
| Slate purge (scoped)  | Replace `slate-*` on 6.18 file chrome with ink/warm tokens (JSON `<pre>` blocks may stay dark for contrast).                                      |

### D6 — Contracts & documentation

| Item          | Acceptance                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Security spec | `tests/security/master-sprint-618.spec.ts` — plan/exit, no API drift, implementation gates.              |
| Exit runbook  | `master-sprint-618-exit.md` through verification and manual smoke.                                       |
| App README    | `apps/admin-tenant/README.md` — 6.18 in progress section.                                                |
| Design system | Optional short delta in `docs/design-system.md` for **config section cards** / **designer publish bar**. |

### D7 — Sprint 6.18b · Configure list edit & guided operations (user feedback)

| Item                   | Acceptance                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Masters list edit      | Revenue, tariff, and address lists use **Edit** / **New** — click loads the guided form; no duplicate raw JSON on the main canvas.                            |
| Masters guided gaps    | Tariffs and address have guided forms (parity with revenue); JSON only in collapsible **Advanced JSON fallback** (`JsonFallbackPanel`).                       |
| Operations section nav | Tabbed sections: Banners · Branding & flags · Templates · KB · Branding assets · Bookings · Staff & roles.                                                    |
| Operations guided gaps | Settings/branding flags, branding asset registration, bookable asset, availability/blackout, reservation, staff invite, role-stage mapping have guided forms. |
| Operations list edit   | Existing rows in each section list are selectable to load the guided editor (templates, KB, assets, bookings calendar, staff maps).                           |
| JSON fallback          | Raw configure payloads are not shown inline; use `JsonFallbackPanel` (`<details>`) per entity.                                                                |
| Shared components      | `record-list-panel.tsx`, `json-fallback-panel.tsx` reused across Masters and Operations.                                                                      |

## Non-goals

- **State Admin** (`:3003`) — Sprint **6.19**.
- **Citizen PWA / mobile** changes (shared tokens only).
- New APIs, DB migrations, workflow JSON schema changes, Desk rules, Keycloak realm changes.
- Replacing JSON editors with wholly visual builders.
- Real-time collaboration, dark mode, i18n key rewrites.

## Expected file touches (indicative)

- `apps/admin-tenant/app/dashboard/masters/masters-client.tsx`
- `apps/admin-tenant/app/dashboard/operations/operations-client.tsx`
- `apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx`
- `apps/admin-tenant/app/dashboard/services/[serviceId]/service-config-panel.tsx`
- `apps/admin-tenant/components/admin-only-panel.tsx` (new)
- `apps/admin-tenant/components/dashboard-shell-layout.tsx` (clerk route guard)
- `apps/admin-tenant/app/globals.css`
- `tests/security/master-sprint-618.spec.ts`
- `docs/runbooks/master-sprint-618-exit.md`

## Verification

```bash
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-618.spec.ts
pnpm test:security
graphify update .
```

Optional: axe spot-check on `/dashboard/masters`, `/dashboard/operations`, `/dashboard/services/:id`.

## Manual smoke

Local stack: API `:3001`, Tenant Admin `:3002`, Keycloak dummies per [`keycloak.md`](./keycloak.md). Password: `DummyDev_2026!ChangeMe`.

| #   | Scenario                                                                                          | Roles                          |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Infra, API, Tenant Admin up                                                                       | —                              |
| 2   | **Admin** Masters: tab/section nav; guided revenue save; tariff save; address CSV dry-run         | `kmc-municipality-admin-dummy` |
| 3   | Admin Masters: catalogue inherited list; adopt or fork (if seed data allows)                      | admin                          |
| 4   | Admin Operations: section tabs; settings guided save; banner list edit; templates/KB list edit    | admin                          |
| 5   | Admin Operations: branding asset + bookable asset guided save; staff invite + role-stage map      | admin                          |
| 6   | Admin: Dashboard → **Configure** → designer loads; palette + publish bar visible; save form draft | admin                          |
| 7   | Admin: workflow canvas still renders; publish workflow control present (no graph regression)      | admin                          |
| 8   | **Clerk** direct URL `/dashboard/masters` → Admin only panel (no unhandled error)                 | `kmc-tenant-clerk-dummy`       |
| 9   | Clerk `/dashboard/operations` and `/dashboard/services/:id` → blocked or Desk redirect            | clerk                          |
| 10  | Clerk Desk regression: inbox + one transition still works                                         | clerk                          |

## Exit criteria

Engineering and manual smoke must all pass before setting plan/exit status to **closed**.

| #   | Criterion                                                                    | Evidence                    |
| --- | ---------------------------------------------------------------------------- | --------------------------- |
| E1  | Masters uses shell + section nav + B+ Pro tokens                             | Code + smoke #2–3           |
| E2  | Operations uses shell + section cards + B+ Pro tokens                        | Code + smoke #4–5           |
| E3  | Designer chrome (toolbar, publish bar, preview frame); graph logic unchanged | Code review + smoke #6–7    |
| E4  | Clerk admin-only routes show intentional UI                                  | Smoke #8–9 + spec           |
| E5  | No `btn-primary` / `btn-secondary` in 6.18-scoped files                      | Grep + spec                 |
| E6  | `useTenantAdminSession` on masters, operations, designer                     | Grep + spec                 |
| E7  | No API route, DB, workflow, or auth contract changes                         | Spec + API discipline       |
| E8  | `typecheck`, `lint`, `build`, `test:security` green                          | CI / local                  |
| E9  | Manual smoke table in exit doc signed **Pass**                               | `master-sprint-618-exit.md` |

## Phase gate

Sprint **6.18** unblocks **6.19** (State Admin + mobile). Phase 7 remains gated on **6.19** UX sign-off.
