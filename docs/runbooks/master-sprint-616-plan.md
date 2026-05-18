# Master Sprint 6.16 Plan — Citizen PWA Workspace & Transactions

Status: **closed** — engineering, manual smoke, and post-smoke polish 2026-05-18; see [`master-sprint-616-exit.md`](./master-sprint-616-exit.md).

**Parent programme:** [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) · **Phase UX citizen workspace pass** · **Gate before Phase 7.**

## Goal

Make the selected-municipality workspace feel like a coherent tenant-branded service desk: clear tenant chrome, polished Services / Apply flow, readable Applications and timeline details, usable Grievances, and receipt-style Payments — **without changing API routes, workflow semantics, form schemas, payment behavior, or i18n keys**.

## Scope

1. **Workspace chrome** — Tenant header bar with logo placeholder, ULB code/name/district, “Switch ULB / Back to hub”, refresh action, and brand-surface wash from `applyTenantTheme`.
2. **Workspace navigation** — Replace the remaining workspace pill tabs with mobile-first tenant-themed navigation using `@enagar/ui` icons and badges where practical.
3. **Services discovery** — Redesign service cards with fee, SLA, docs, DigiLocker, popular, and category chips; preserve shortcut filter and “show all services”.
4. **Apply flow** — Wrap `@enagar/forms/web` output in a clearer wizard-like card: selected service summary, section spacing, document expectations, property-tax holding lookup panel, submit bar.
5. **Applications** — Split list/detail with status badges, payment state, service metadata, and timeline styling; keep existing `ApplicationDetailPanel` API behavior.
6. **Grievances** — Align `components/grievances-workspace.tsx` to Tricolor Calm cards, tenant status badges, compose/detail empty states, and 360 px mobile layout.
7. **Payments** — Receipt-style payment cards, clearer retry/settled/failed states, stub capture affordance, receipt metadata panel, and empty states.
8. **Tenant banners** — Keep Sprint 6.8 banner data path; restyle banners to match 6.16 workspace card chrome if needed.
9. **Contracts / docs** — Add `tests/security/master-sprint-616.spec.ts`; close with `docs/runbooks/master-sprint-616-exit.md`.

## Non-goals

- Citizen auth / hub redesign — completed in **6.15** except regression fixes.
- Admin Tenant / State Admin UI changes — Sprints **6.17–6.19**.
- Mobile app parity — Sprint **6.19**.
- New APIs, DB migrations, workflow changes, payment gateway changes, service-schema changes, or i18n key rewrites.
- Real PSP, receipt PDF generation, DigiLocker push implementation, or offline mode.
- Dark mode.

## Design Direction

- **Tone:** tenant-branded civic workspace. The hub stays calm and statewide; workspace becomes clearly “inside KMC/HMC/CMC” through brand surface, stripe, and action hierarchy.
- **Hierarchy:** tenant identity → next recommended action → transaction lists → detail panels.
- **Motion:** no heavy animation; focus on tactile cards, clear focus rings, and reduced-motion-safe transitions.
- **Copy:** remove developer/API jargon from primary citizen-facing panels; keep operational details only where they help smoke/test recovery.

## Expected File Touches

- `apps/citizen-pwa/app/page.tsx` — compose extracted workspace components and reduce inline transaction markup.
- `apps/citizen-pwa/components/*workspace*.tsx` or new `components/citizen-workspace-*.tsx` — local workspace chrome, service cards, payments, applications sections.
- `apps/citizen-pwa/components/application-detail-panel.tsx` — timeline/status visual polish only; no API contract change.
- `apps/citizen-pwa/components/grievances-workspace.tsx` — card/status/empty-state polish only.
- `tests/security/master-sprint-616.spec.ts` — doc/UI contract for no API drift and workspace UX affordances.
- `docs/runbooks/master-sprint-616-exit.md` — exit artifact after verification and smoke.

## Verification

```bash
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa lint
pnpm --filter @enagar/citizen-pwa build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-616.spec.ts
pnpm test:security
pnpm --filter @enagar/citizen-pwa quality:ci
graphify update .
```

Quality target: Lighthouse accessibility **>= 0.90** on the served Citizen PWA, plus manual 360 px viewport check for workspace Services / Apply / Applications / Grievances / Payments.

## Manual Smoke

1. Login → hub → choose KMC/HMC/CMC → workspace header shows tenant code/name/district and brand surface.
2. Workspace navigation: Home, Services, Apply, Applications, Payments, Grievances reachable at 360 px and desktop.
3. Services: service cards show fee/SLA/docs/DigiLocker/popular/category chips; pinned service shortcut filter and “show all services” still work.
4. Apply: Birth Certificate form renders with 6.16 spacing; default fields still match published schema; submit path unchanged.
5. Applications: submitted docket appears; detail panel opens; timeline, comments, payment CTA, and status badges are readable.
6. Grievances: file grievance, view list/detail, status/empty states are readable and tenant-scoped.
7. Payments: initiate/stub-complete path remains usable; settled payment shows receipt metadata placeholder; failed/retry states are clear.
8. Back to hub resets tenant theme; switching KMC/HMC/CMC visibly changes workspace brand.

## Exit Criteria

- Selected-tenant workspace visibly uses tenant-derived `--brand-*` tokens and 6.14/6.15 primitives.
- Workspace chrome and transaction sections are extracted enough that `page.tsx` is not the long-term home for all UI markup, or blocker is documented before exit.
- No API route, DB, workflow, payment, service schema, or i18n-key changes.
- 360 px viewport is usable across workspace Home, Services, Apply, Applications, Payments, and Grievances.
- Verification commands pass, including the 6.16 security/doc contract and full security suite.
- Manual smoke is signed off in `master-sprint-616-exit.md`.
