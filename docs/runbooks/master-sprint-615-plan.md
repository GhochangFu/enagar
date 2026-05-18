# Master Sprint 6.15 Plan — Citizen PWA Auth, Hub & Navigation

Status: **closed** — see [`master-sprint-615-exit.md`](./master-sprint-615-exit.md) (engineering + manual smoke 2026-05-18).

**Parent programme:** [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) · **Phase UX citizen-first pass** · **Gate before Phase 7.**

## Goal

Give the Citizen PWA its first visible **Tricolor Calm** experience: polished splash / language / OTP entry, clearer pinned-municipality hub, mobile-first navigation, and Apply picker polish — **without changing API flows, service schemas, i18n keys, or workspace transaction logic**.

## Scope

1. **Auth / onboarding shell** — Full-screen Tricolor Calm splash, language selection card, mobile OTP form with 6.15-grade spacing, focus states, and reduced-motion-safe error feedback.
2. **Hub layout** — Extract `CitizenAuthLayout` and `CitizenHubLayout` from `apps/citizen-pwa/app/page.tsx` so the page stops growing as one monolith.
3. **Pinned municipality cards** — Redesign hub cards with tenant colour stripe, clearer short name / district, KPI chips, disabled state for catalogue mismatches, and strong tap target hierarchy.
4. **Hub navigation** — Replace the current tab-strip feel on hub with mobile-first bottom / sticky navigation using `@enagar/ui` `Icon`, `Button`, `Badge`, and `Card` where practical.
5. **Shortcuts editor** — Polish pinned ULB and pinned-service editor so add/remove states are obvious, max-15 rule is visible, and empty states guide the user.
6. **Apply picker / browse modal** — Preserve the Sprint 6.13 `/tenants` catalogue fix; improve search, ULB grid, “Enter workspace”, and service shortcut visual affordances.
7. **Accessibility + responsive pass** — 360 px Android viewport, keyboard focus, visible labels, reduced motion, and bn/hi text overflow spot-check.
8. **Contracts / docs** — Add a focused security/doc contract for 6.15 and close with `docs/runbooks/master-sprint-615-exit.md`.

## Non-goals

- Workspace transaction redesign (`services`, `applications`, `grievances`, `payments`) — Sprint **6.16**.
- Admin Tenant / State Admin UI changes — Sprints **6.17–6.19**.
- Mobile app parity — Sprint **6.19**.
- New APIs, database migrations, auth semantics, service-schema changes, or i18n key rewrites.
- Dark mode.

## Design Direction

- **Tone:** refined civic calm, not flashy. Use Tricolor Calm canvas with soft saffron/green atmospheric washes and tenant colour only for actionable emphasis.
- **Typography:** keep Plus Jakarta Sans + Noto stack from 6.14; avoid Inter reintroduction.
- **Motion:** one restrained entry transition and small tap / error feedback only; obey `prefers-reduced-motion`.
- **Information hierarchy:** citizen sees “what do I do next?” first; debug / API implementation details should move out of primary copy.

## Expected File Touches

- `apps/citizen-pwa/app/page.tsx` — slim orchestration and compose extracted layouts/components.
- `apps/citizen-pwa/app/*.tsx` or `apps/citizen-pwa/components/*` — new citizen-only shell/cards/nav components if local pattern supports it.
- `packages/ui/src/components/*` — only if a primitive is broadly reusable; avoid adding one-off components here.
- `tests/security/master-sprint-615.spec.ts` — contract for no API drift, hub UX affordances, and Phase UX gate.
- `docs/runbooks/master-sprint-615-exit.md` — exit artifact after verification and smoke.

## Verification

```bash
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa lint
pnpm --filter @enagar/citizen-pwa build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-615.spec.ts
pnpm test:security
graphify update .
```

Lighthouse / accessibility target:

```bash
pnpm --filter @enagar/citizen-pwa quality:ci
```

Exit threshold: hub accessibility score **>= 90** or documented local blocker with manual WCAG checklist pass.

## Manual Smoke

1. Login path: splash → language → mobile OTP (`12345` in dev) → pin KMC → hub.
2. Hub tabs/nav: Home, Apply, Applications, Payments, Grievances, Shortcuts remain reachable at 360 px and desktop widths.
3. Pinned municipalities: KMC/HMC/CMC cards show tenant stripe, KPI chips, and enter workspace on tap.
4. Shortcuts: add/remove pinned ULBs, max-15 rule visible, pinned service shortcut opens workspace Services filtered to that service.
5. Apply picker: Browse all municipalities search works; selecting a ULB from Apply opens workspace Services; Sprint 6.13 catalogue fix remains intact.
6. Accessibility spot-check: keyboard focus visible, labels present, reduced motion acceptable, bn/hi copy does not break core cards.

## Exit Criteria

- Citizen hub and auth screens visibly use 6.14 Tricolor Calm tokens and reusable primitives where appropriate.
- `apps/citizen-pwa/app/page.tsx` is reduced by extracting auth/hub layout concerns, or an explicit blocker is documented before exit.
- No API route, database, service schema, or translation-key changes.
- 360 px viewport is usable for auth, hub cards, bottom/sticky navigation, and Browse modal.
- Verification commands above pass, including the 6.15 security/doc contract.
- Manual smoke is signed off in `master-sprint-615-exit.md`.
