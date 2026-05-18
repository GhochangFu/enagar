# Master Sprint 6.14 Plan — UX Foundation & Design System v2

Status: **closed** — see [`master-sprint-614-exit.md`](./master-sprint-614-exit.md) (engineering 2026-05-18).

**Parent programme:** [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) · **Gate before Phase 7.**

## Goal

Establish **Tricolor Calm** platform tokens, **tenant palette derivation** (brand / muted / surface), expanded **`@enagar/ui`** primitives, and Storybook — without full page rewrites in citizen or admin apps.

## Scope

1. **Tokens** — Update `docs/design-system.md` §2; Tailwind preset in `@enagar/config`; CSS variables (`bg-canvas`, saffron/green washes, warm borders).
2. **`@enagar/tenant-theme`** — `createTenantPalette(hex)`; `--brand-muted-rgb`, `--brand-surface-rgb`; unit tests (contrast, hex edge cases); remove **Inter** as default `fontFamily`.
3. **`@enagar/ui`** — `Button`, `Card`, `Badge`, `Icon`, `PageHeader`, `Spinner`, `Skeleton` (web).
4. **Storybook** — Stories for primitives + KMC / HMC / CMC theme samples.
5. **CI** — `typecheck` / `lint` for touched packages; optional security contract stub if new public assets only.

## Non-goals

- Citizen hub / admin shell layout refactors (Sprints **6.15+**).
- Dark mode.
- API or i18n key changes.

## Verification

```bash
pnpm --filter @enagar/tenant-theme typecheck
pnpm --filter @enagar/ui typecheck
pnpm --filter @enagar/config typecheck
# Storybook build when wired (e.g. pnpm --filter @enagar/ui storybook:build)
pnpm test:security
graphify update .
```

## Manual smoke

1. Storybook: primary / secondary buttons, cards, badges in default + KMC theme.
2. Stub page or existing app: `applyTenantTheme(KMC)` sets header tint and CTA colour; `applyTenantTheme(null)` restores platform pastels.

## Exit artifact

- `docs/runbooks/master-sprint-614-exit.md` when complete.
