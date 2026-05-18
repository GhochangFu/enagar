# Phase UX — Cross-Portal UI/UX Revamp (Plan)

**Status:** **Confirmed by sponsor — 2026-05-18.** Implementation not started; begin with **Sprint 6.14**.  
**Gate:** **Sprints 6.14–6.19** must close (engineering + manual smoke) **before** [Phase 7 — Sahayak AI](../ROADMAP.md). Sprint **6.13** (functional Desk) remains closed — UX is the next programme track.  
**Surfaces:** Citizen PWA (`:3000`), Tenant Admin + Clerk Desk (`:3002`), State Admin (`:3003`), and **`apps/mobile`** (parity in **6.19**).

---

## 1. Why this phase exists

Functional slices through Sprint **6.13** delivered operator Desk, catalogue alignment, and reporting — but UI is still largely **utility-first Tailwind in monolithic clients** (e.g. citizen `page.tsx` ~2,600 lines, tenant Operations ~1,400 lines). Citizens and clerks need a **cohesive, dignified government-grade experience** that:

- Feels trustworthy and calm (not startup-generic or “AI slop”).
- Respects **per-ULB brand colour** when a citizen enters a municipality workspace or a clerk works that tenant’s queue.
- Keeps **ease of use** for low-literacy and multilingual users (en / bn / hi).
- Aligns all three web portals to one visual language without forking layouts per tenant.

This plan does **not** change APIs, workflow JSON, auth, or business rules — only presentation, layout, shared components, and motion within existing contracts.

---

## 2. Design direction — “Tricolor Calm”

### 2.1 Concept

| Layer                | Role                                                    | Treatment                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platform shell**   | WB statewide citizen hub, State Admin, login screens    | Soft **pastels** inspired by the Indian tricolour — **never** literal flag stripes or Ashoka Chakra in UI chrome (avoids political/visual noise). Ambient warmth + clarity. |
| **Tenant workspace** | Citizen ULB module, Tenant Admin when scoped to one ULB | **Stored `theme_color`** drives accent, header band, focus rings, and pastel tints. User always knows _which municipality_ they are in.                                     |
| **Semantic**         | Status, SLA, payments                                   | Unchanged verb mapping from `docs/design-system.md` (success / warning / danger / info).                                                                                    |

### 2.2 Proposed platform palette (pastel neutrals)

These are **defaults** when no tenant is selected (hub, state portal). Values are starting points for design review:

| Token             | Light mode (hex) | Use                                                    |
| ----------------- | ---------------- | ------------------------------------------------------ |
| `bg-canvas`       | `#FAFAF8`        | Page background (warm paper white)                     |
| `bg-saffron-wash` | `#FFF7ED`        | Hero / onboarding gradient stop (soft saffron)         |
| `bg-green-wash`   | `#F0FDF4`        | Secondary gradient stop (soft green)                   |
| `bg-surface`      | `#FFFFFF`        | Cards, panels                                          |
| `border-subtle`   | `#E8E4DF`        | Warm gray border (not cold slate-only)                 |
| `text-primary`    | `#1C1917`        | Stone-900 body                                         |
| `accent-platform` | `#0E7490`        | State / hub links (teal — distinct from tenant brands) |

Tenant **primary** remains `theme_color` from DB/seed; we **derive** programmatically:

- `--brand-rgb` (existing) — CTAs, active tab, key buttons.
- `--brand-muted-rgb` (new) — 12–18% opacity fills for cards, inbox row hover, desk queue highlight.
- `--brand-surface-rgb` (new) — workspace header gradient base (pastelized LCH mix toward white).
- `--brand-fg-rgb` (existing) — auto contrast for text on solid brand.

**Contrast rule (retained):** AA minimum 4.5:1 for text on brand fills; admin colour picker already blocks sub-AA saves — extend validation to **muted** surfaces if we auto-generate tints.

### 2.3 Typography & character (locked)

| Role                | Family                                                                       | Notes                                                                    |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Latin (en)**      | [**Plus Jakarta Sans**](https://fonts.google.com/specimen/Plus+Jakarta+Sans) | Headings + body; load weights 400, 500, 600, 700.                        |
| **Bengali (bn)**    | **Noto Sans Bengali**                                                        | Primary when locale is `bn`; +4px line-height on body text.              |
| **Hindi (hi)**      | **Noto Sans Devanagari**                                                     | Primary when locale is `hi`; +4px line-height on body text.              |
| **Fallback**        | `system-ui, sans-serif`                                                      | Only after Noto / Plus Jakarta.                                          |
| **Removed default** | ~~Inter~~                                                                    | Drop from `@enagar/tenant-theme` `DEFAULT_THEME.fontFamily` in **6.14**. |

**Numerals:** `font-variant-numeric: tabular-nums` on dockets, fees, dates.

**Motion:** Subtle only — 150–250 ms transitions, staggered list reveal on hub load, respect `prefers-reduced-motion`. No hero video or long animations (design-system principle 7).

### 2.4 Differentiation (per frontend-design skill)

- **Memorable moment:** Entering a tenant workspace — soft colour wash + ULB code + ward count + optional logo animates in (opacity + 8px rise, 200 ms).
- **Citizen:** Large touch targets, one primary action per screen, bottom nav with clear icons (Lucide, not emoji).
- **Clerk Desk:** Dense but scannable — split inbox + detail, status chips, timeline as vertical rail (not raw text blocks).
- **State Admin:** Cooler platform teal accent, data-dense tables, executive summary cards — visually distinct from tenant warm pastels.

---

## 3. Technical architecture (shared)

### 3.1 Packages (extend, don’t fork)

| Package                   | Changes                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@enagar/tenant-theme`    | `createTenantPalette(hex)` → brand + muted + surface RGB; optional CSS vars; SSR-safe `applyTenantTheme` on workspace mount / clear on hub return.                                                        |
| `@enagar/config/tailwind` | Token v2: `bg-canvas`, `bg-saffron-wash`, semantic shadows, tenant utilities `bg-brand-muted`, `border-brand/20`.                                                                                         |
| `@enagar/ui`              | Grow from form primitives to **layout + data display**: `Button`, `Card`, `Badge`, `AppShell`, `PageHeader`, `BottomNav`, `Sidebar`, `DataTable`, `EmptyState`, `Timeline`, `StatCard`, `Modal`, `Toast`. |
| `@enagar/forms/web`       | Visual polish only — field density, error states, section spacing tied to new tokens.                                                                                                                     |

### 3.2 App structure (incremental refactor)

| App              | Strategy                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **citizen-pwa**  | Extract hub vs workspace into route groups or sub-layouts; shrink `page.tsx` into feature modules (`hub/`, `workspace/`, `auth/`).                           |
| **admin-tenant** | Shared `TenantAdminShell` (sidebar + top bar + role-aware nav: Desk for clerks, full nav for admin). Unify `btn-primary` / ad-hoc classes with `@enagar/ui`. |
| **admin-state**  | `StateAdminShell` — distinct platform accent; reuse table/card primitives from tenant where possible.                                                        |

### 3.3 Tenant colour behaviour (citizen)

```text
[Hub]  platform pastels, pinned ULB cards show theme_color stripe only
         ↓ chooseTenant()
[Workspace]  applyTenantTheme(tenant) + workspace header uses --brand-surface-rgb
         tabs, CTAs use --brand-rgb
         ↓ goBackToHub()
[Hub]  clear tenant vars → platform shell restored
```

Desk and Tenant Dashboard **already** scoped to JWT tenant — same `applyTenantTheme` on layout mount.

### 3.4 Explicit non-goals

- No new REST endpoints or DTO changes for UX alone.
- No translation key renames (copy tweaks only if sponsor approves separate copy sprint).
- No redesign of React Flow workflow graph or form designer **logic** — only chrome, panels, spacing, icons.
- No Phase 7 chatbot UI in this phase (separate sprint after RAG backend; may reuse tokens from UX phase).
- No dark mode in v1 unless sponsor adds scope in **6.19**.

---

## 4. Sprint breakdown (recommended)

Program ID: **Phase UX** implemented as **Master Sprints 6.14 → 6.19** (six sprints). Each sprint ends with **visual smoke** + `typecheck` / `lint` / `build` + updated exit runbook. Security contracts only if layout touches auth surfaces.

### Sprint 6.14 — UX foundation & design system v2

**Goal:** One source of truth for tokens, tenant palettes, and primitives — no full page rewrites yet.

| Workstream   | Deliverables                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Tokens       | `docs/design-system.md` §2 update; CSS variables in Tailwind preset; Tricolor Calm neutrals + semantic colours. |
| Tenant theme | `createTenantPalette()`, new CSS vars, unit tests (contrast, hex edge cases).                                   |
| `@enagar/ui` | `Button`, `Card`, `Badge`, `Icon` wrapper, `PageHeader`, `Spinner`, `Skeleton`.                                 |
| Tooling      | Storybook (or Ladle) stories for primitives; optional Chromatic later.                                          |
| CI           | Visual regression optional; lint rule discouraging raw `bg-brand` without semantic alias.                       |

**Exit criteria:** Storybook builds; KMC/HMC sample themes in stories; AA contrast test for generated muted surfaces.

**Manual smoke:** Toggle theme in Storybook; apply KMC theme on a stub page.

---

### Sprint 6.15 — Citizen PWA: auth, hub & navigation

**Goal:** First citizen-facing “wow” — onboarding through hub without changing API flows.

| Area                    | Changes                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Splash / language / OTP | Full-screen pastel gradient; improved OTP boxes; error shake (reduced-motion safe).                                                           |
| Hub                     | Redesigned pinned municipality cards (theme stripe, KPI chips, clearer typography); bottom nav with Lucide icons; refreshed Shortcuts editor. |
| Apply picker            | Keep 6.13 fix; visual polish for ULB grid + browse modal.                                                                                     |
| Layout                  | Extract `CitizenHubLayout`, `CitizenAuthLayout`.                                                                                              |

**Exit criteria:** Hub + OTP flows match `docs/help/start-the-app-step-by-step.md`; bn/hi screenshots spot-checked; Lighthouse accessibility ≥ 90 on hub.

**Manual smoke:** Login → pin KMC → hub tabs → browse municipality → enter workspace (theme applies).

---

### Sprint 6.16 — Citizen PWA: workspace & transactions

**Status:** **Closed 2026-05-18** — [`master-sprint-616-exit.md`](./master-sprint-616-exit.md).

**Goal:** Tenant-themed service discovery, apply, applications, grievances, payments.

| Area             | Changes                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Workspace chrome | Tenant header bar (logo, code, “Switch ULB”), themed tab bar, banners from 6.8 styled consistently.  |
| Services / Apply | Service cards with fee/SLA chips; form wizard spacing via `@enagar/forms/web` + new section headers. |
| Applications     | Split list + detail; timeline component; document list styling.                                      |
| Grievances       | Align `grievances-workspace.tsx` to new cards; color-coded status/priority chips (hub + tenant).     |
| Payments         | Receipt-style cards; empty states with illustrations.                                                |

**Exit criteria:** `applyTenantTheme` visible on workspace; submit birth-cert + grievance UI-only regression; mobile viewport 360px OK.

**Manual smoke:** Full citizen path from 6.13 exit checklist with new UI.

---

### Sprint 6.17 — Tenant Admin: shell, dashboard & Desk

**Goal:** Professional operator workstation; clerk-first Desk beauty.

| Area      | Changes                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Shell     | Sidebar (collapsible), tenant badge, role-aware items (Desk-only for clerks), user menu.             |
| Login     | Match citizen quality; Keycloak redirect branded.                                                    |
| Dashboard | KPI cards, trend charts styling, breached-queue cards as clickable tiles → Desk deep links.          |
| Desk      | Inbox list density, detail panel timeline, action buttons hierarchy, `cache: no-store` UX preserved. |
| Globals   | Replace ad-hoc `btn-primary` with `@enagar/ui` variants.                                             |

**Exit criteria:** Clerk lands Desk; admin sees full nav; CSV/PDF export buttons visually consistent.

**Manual smoke:** 6.13 Desk scenarios (clerk + admin) on new chrome.

---

### Sprint 6.18 — Tenant Admin: Masters, Operations & designer chrome

**Goal:** Config surfaces feel guided, not “JSON forms on white.”

| Area             | Changes                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| Masters          | Tabbed sections, revenue/tariff forms aligned to 6.10 guided UX.                     |
| Operations       | Staff invite, KB, branding, flags — section cards, sticky save bars.                 |
| Service designer | Palette + canvas toolbars, publish bar, preview panel frame (no graph logic change). |
| 403 states       | Clerk on Masters — friendly locked state (not raw “403/403”).                        |

**Exit criteria:** Admin can configure birth-cert workflow + form without layout regressions; clerk blocked UI is intentional and clear.

---

### Sprint 6.19 — State Admin & cross-portal finish

**Goal:** State portal parity + holistics.

| Area            | Changes                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| State dashboard | Executive layout, tenant directory table, audit filters, integration cockpit cards.                                                                 |
| Cross-cutting   | Shared empty/error pages; toast notifications; focus rings; print styles for PDF/CSV pages.                                                         |
| Mobile          | **`apps/mobile`:** themed home, tenant picker, OTP shell; `applyTenantTheme` on municipality workspace — aligned to Tricolor Calm tokens from 6.14. |
| Docs            | Exit runbook `master-sprint-619-exit.md`; update `start-the-app-step-by-step.md` screenshots placeholders.                                          |

**Exit criteria:** All three portals share tokens; state visually distinct; full regression smoke script passes.

**Manual smoke:** State admin login; tenant drill-down; tenant admin + citizen spot checks.

---

### Optional Sprint 6.20 — Hardening (if needed)

- Performance: bundle split citizen `page.tsx` routes; image optimization for logos.
- i18n visual QA matrix (en/bn/hi) for top 10 screens.
- Sponsor sign-off workshop + pilot feedback fixes.

---

## 5. Phase gate vs Phase 7

| Option                       | Recommendation                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Serial (recommended)** | Complete **6.14–6.19** (and 6.20 if needed); **then** start Phase 7 backend + chatbot UI using new tokens.                                      |
| **B — Parallel**             | Phase 7 RAG indexer/backend starts after **6.14**; chatbot UI sprint **7.x** uses UX tokens from 6.14+. Risk: merge conflicts in `citizen-pwa`. |

**Suggested gate for Phase 7:** `master-sprint-619-exit.md` signed + citizen + clerk manual smoke on revamp UI.

---

## 6. Verification matrix (per sprint)

| Check                                                    | Applies          |
| -------------------------------------------------------- | ---------------- |
| `pnpm --filter @enagar/citizen-pwa typecheck`            | 6.15–6.16        |
| `pnpm --filter @enagar/admin-tenant typecheck` + `build` | 6.17–6.18        |
| `pnpm --filter @enagar/admin-state typecheck` + `build`  | 6.19             |
| `pnpm test:security` (no regressions on auth routes)     | All              |
| WCAG spot-check (axe) on hub, Desk, state dashboard      | 6.15, 6.17, 6.19 |
| Tenant theme snapshot (KMC, HMC, CMC)                    | 6.14, 6.16       |
| `graphify update .` after code merges                    | All              |

---

## 7. Risks & mitigations

| Risk                                    | Mitigation                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Monolith refactor breaks hub deep links | Keep URL/query contract tests; incremental extract, not big-bang rewrite.                 |
| Pastel + tenant colour clash            | Muted tokens derived in LCH; never place body text on muted fills without contrast check. |
| Bengali/Hindi overflow                  | Test on 360px; truncate with tooltips; +4px line-height per design-system.                |
| Clerk low-bandwidth                     | No heavy images; CSS-only gradients; lazy logos.                                          |
| Scope creep into Phase 7 chatbot        | Freeze chatbot UI to wireframe-only in 6.19 unless sponsor expands.                       |

---

## 8. Deliverables checklist (documentation)

When implementation starts, each sprint adds:

- `docs/runbooks/master-sprint-6XX-plan.md` (short)
- `docs/runbooks/master-sprint-6XX-exit.md` (engineering + manual smoke)
- `docs/design-system.md` delta
- `tests/security/master-sprint-6XX.spec.ts` only if new public surfaces
- Screenshots in `docs/help/` (optional folder `docs/help/screenshots/ux-6xx/`)

---

## 9. Confirmed decisions (2026-05-18)

| #   | Decision                                   | Outcome                                                                           |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| 1   | Program **6.14–6.19** gates Phase 7        | **Yes**                                                                           |
| 2   | **Tricolor Calm** + tenant-derived accents | **Agreed**                                                                        |
| 3   | Typography                                 | **Plus Jakarta Sans + Noto** (bn/hi); Inter removed from theme default — see §2.3 |
| 4   | Mobile                                     | **In Sprint 6.19** (`apps/mobile` parity)                                         |
| 5   | Dark mode                                  | **Out of scope** for UX v1                                                        |
| 6   | Sprint order                               | **Citizen-first** (6.15–6.16 → 6.17–6.18 → 6.19 state + mobile)                   |

**Next implementation run:** start **Sprint 6.17** (Tenant Admin shell, dashboard & Desk) — plan TBD as `master-sprint-617-plan.md`.

---

## 10. References

- [`docs/design-system.md`](../design-system.md) — current tokens and principles
- [`packages/tenant-theme`](../../packages/tenant-theme/src/index.ts) — runtime theme today
- [`docs/runbooks/master-sprint-613-exit.md`](./master-sprint-613-exit.md) — last functional gate before this phase
- [`ROADMAP.md`](../../ROADMAP.md) — Phase 7 Sahayak AI (next functional phase after UX sign-off)

---

_Last updated: 2026-05-18 — Sprint 6.16 closed; ready for Sprint 6.17._
