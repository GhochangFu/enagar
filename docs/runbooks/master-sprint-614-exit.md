# Master Sprint 6.14 Exit — UX Foundation & Design System v2

Status: **closed — engineering and manual smoke 2026-05-18**. **Next:** Sprint **6.15** (citizen hub shell) per [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md).

## Delivered

- **Tricolor Calm** platform tokens in `@enagar/config` (`styles/tricolor-calm.css`, Tailwind `canvas`, saffron/green washes, `ink.*`, `warm.border`, `platform-gradient`).
- **`@enagar/tenant-theme`** — `createTenantPalette(hex)` with `--brand-muted-rgb` / `--brand-surface-rgb`; `applyPlatformTheme()` for hub shell; **Plus Jakarta Sans** default (Inter removed); unit tests for hex, contrast, and platform apply.
- **`@enagar/ui`** primitives: `Button`, `Card`, `Badge`, `Icon`, `PageHeader`, `Spinner`, `Skeleton` (+ existing form primitives).
- **Storybook** in `packages/ui` with tenant toolbar (Platform / KMC / HMC / CMC) via `applyTenantTheme`.
- App globals import tricolor CSS: `citizen-pwa`, `admin-tenant`, `admin-state`.
- Security contract `tests/security/master-sprint-614.spec.ts` documents token, theme, UI, and programme expectations.

## Non-goals preserved

- No citizen hub or admin shell layout refactors (6.15+).
- No dark mode.
- No API or i18n key changes.

## Verification

Completed 2026-05-18:

```bash
pnpm --filter @enagar/tenant-theme typecheck   # pass
pnpm --filter @enagar/tenant-theme test        # 9/9 pass
pnpm --filter @enagar/ui typecheck             # pass
pnpm --filter @enagar/ui storybook:build       # pass
pnpm test:security -- --runTestsByPath tests/security/master-sprint-614.spec.ts  # 5/5 pass
graphify update .                              # pass
```

## Manual smoke

**Signed off 2026-05-18** — Storybook (`:6006`), Citizen PWA (`:3000`).

| #   | Scenario                                                                                                                                                                            | Result |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | `pnpm --filter @enagar/ui storybook` — primitives (Buttons, Cards, Loading, Icons); toolbar **ULB theme** (paintbrush) → Platform / KMC / HMC / CMC brand shift                     | Pass   |
| 2   | Citizen PWA — hub canvas + default brand; workspace `applyTenantTheme` on ULB enter; `--brand-rgb` / `bg-brand` CTAs match ULB; **Back to hub** resets via `applyTenantTheme(null)` | Pass   |

## Phase gate

Phase 7 remains gated on **6.19** (mobile parity + state admin). Sprint **6.14** unblocks **6.15** citizen hub UX only.
