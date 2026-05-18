# Master Sprint 6.15 Exit — Citizen PWA Auth, Hub & Navigation

Status: **closed — engineering and manual smoke 2026-05-18**. **Next:** Sprint **6.16** (Citizen PWA workspace & transactions) per [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md).

## Delivered

- Extracted citizen auth/onboarding screens from `apps/citizen-pwa/app/page.tsx` into `components/citizen-auth-flow.tsx`.
- Added Tricolor Calm auth frame for splash, language, mobile OTP, and first-time municipality pinning.
- Extracted hub navigation, KPI grid, pinned municipality card, and Browse modal into `components/citizen-hub-components.tsx`.
- Replaced the hub tab strip with icon-based sticky hub navigation using `@enagar/ui` primitives.
- Polished pinned ULB cards with tenant stripe, clearer hierarchy, KPI chips, disabled catalogue mismatch state, and stronger focus states.
- Polished Browse municipalities modal while preserving the Sprint 6.13 `/tenants` catalogue path and Apply-to-workspace Services handoff.
- Added Tailwind and TypeScript coverage for `apps/citizen-pwa/components`.
- Added `tests/security/master-sprint-615.spec.ts` to lock 6.15 UX scope and no-API-drift expectations.

## Non-goals Preserved

- No workspace transaction redesign (`services`, `applications`, `grievances`, `payments`).
- No admin portal changes.
- No mobile app changes.
- No API route, database migration, service-schema, or i18n-key changes.
- No dark mode.

## Verification

Completed:

```bash
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa lint
pnpm --filter @enagar/citizen-pwa build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-615.spec.ts
pnpm test:security
pnpm --filter @enagar/citizen-pwa quality:ci  # accessibility 1.00, performance 0.70, best-practices 1.00
graphify update .
```

`quality:ci` was run against `http://127.0.0.1:3000` on 2026-05-18.

## Manual Smoke

**Signed off 2026-05-18** — Citizen PWA (`:3000`), dev OTP `12345`.

| #   | Scenario                                                                                                       | Result |
| --- | -------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Splash → language → mobile OTP (`12345` dev) → pin KMC → hub                                                   | Pass   |
| 2   | Hub icon nav: Home, Apply, Applications, Payments, Grievances, Shortcuts at 360 px and desktop                 | Pass   |
| 3   | Pinned KMC/HMC/CMC cards show tenant stripe, KPI chips, and enter workspace on tap                             | Pass   |
| 4   | Shortcuts add/remove ULBs and pinned service shortcut opens workspace Services filtered to that service        | Pass   |
| 5   | Apply picker Browse search works; selecting ULB from Apply opens workspace Services; 6.13 catalogue fix intact | Pass   |
| 6   | Keyboard focus, reduced motion, and bn/hi text spot-check on auth + hub                                        | Pass   |

## Phase Gate

Sprint **6.15** unblocks **6.16** workspace UX. Phase 7 remains gated on **6.19**.
