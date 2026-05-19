# Master Sprint 6.16 Exit — Citizen PWA Workspace & Transactions

Status: **closed — engineering, manual smoke signed off, and post-smoke UX polish complete (2026-05-18)**. No open exit criteria. **Next:** Sprint **6.17** (Tenant Admin: shell, dashboard & Desk) per [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md).

## Delivered

- Added `components/citizen-workspace-components.tsx` for selected-tenant workspace chrome, navigation, service cards, payment cards, shortcut filter banner, and empty states.
- Replaced the remaining workspace pill tabs with tenant-themed icon navigation.
- Replaced inline workspace header metrics with a tenant brand-surface header using `--brand-*` runtime tokens.
- Replaced inline service cards with reusable service cards showing category, fee, SLA, docs, DigiLocker, and popular status.
- Replaced inline payment rows with receipt-style payment cards while preserving stub capture and receipt metadata behavior.
- Preserved existing Apply form runtime, property-tax holding lookup, application detail panel, payment APIs, and grievance APIs.
- Added `tests/security/master-sprint-616.spec.ts` to lock no-API-drift and workspace UX expectations.
- Added post-smoke Citizen PWA polish from operator feedback: stronger Tricolor Calm splash/hub treatment, professional Apply municipality cards, color-coded application cards, and improved application/grievance detail surfaces.
- Added a second grievance polish pass: hub and tenant grievance cards now color-code status and priority, detail screens use stronger case-header hierarchy, and the Citizen PWA font stack is tuned for cleaner Latin/Bengali/Devanagari rendering.

## Non-goals Preserved

- No citizen auth, routing, or API behavior changes beyond visual polish.
- No admin portal changes.
- No mobile app changes.
- No API route, database migration, workflow, payment gateway, service-schema, or i18n-key changes.
- No real PSP, receipt PDF generation, DigiLocker push implementation, offline mode, or dark mode.

## Verification

Completed:

```bash
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa lint
pnpm --filter @enagar/citizen-pwa build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-616.spec.ts
pnpm test:security
pnpm --filter @enagar/citizen-pwa quality:ci  # accessibility 1.00, performance 0.99, best-practices 0.96
graphify update .
```

`quality:ci` was run against `http://127.0.0.1:3000` on 2026-05-18. Cold-start probes can return zero scores until the dev server is warm; retry after HTTP 200 passed. Grievance polish reruns: performance `0.55` on first pass, `0.99` warmed; one run failed only during Lighthouse temp-profile cleanup (`EBUSY`) after scoring.

## Manual Smoke

**Complete — signed off 2026-05-18** — Citizen PWA (`:3000`), dev OTP `12345`. Operator confirmed all scenarios **Pass** after workspace delivery and grievance/status polish.

| #   | Scenario                                                                                                                      | Result |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Login → hub → choose KMC/HMC/CMC → workspace header shows tenant code/name/district and brand surface                         | Pass   |
| 2   | Workspace navigation: Home, Services, Apply, Applications, Payments, Grievances at 360 px and desktop                         | Pass   |
| 3   | Services cards show fee/SLA/docs/DigiLocker/popular/category chips; shortcut filter and “show all services” work              | Pass   |
| 4   | Apply Birth Certificate form renders with 6.16 spacing; default fields still match published schema; submit path unchanged    | Pass   |
| 5   | Applications list/detail opens; timeline, comments, payment CTA, and status badges are readable                               | Pass   |
| 6   | Grievances file/list/detail states are readable and tenant-scoped                                                             | Pass   |
| 7   | Payments initiate/stub-complete path works; settled payment shows receipt metadata placeholder; failed/retry states are clear | Pass   |
| 8   | Back to hub resets tenant theme; switching KMC/HMC/CMC visibly changes workspace brand                                        | Pass   |

## Closure

- Engineering verification: complete (see §Verification).
- Manual smoke (8 scenarios): **Pass** — sprint may be treated as closed for programme tracking.
- Post-smoke UX polish (hub, applications, grievances): delivered in-repo; no follow-up blockers recorded.

## Phase Gate

Sprint **6.16** unblocks **6.17** admin UX. Phase 7 remains gated on **6.19**.
