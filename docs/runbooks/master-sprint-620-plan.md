# Master Sprint 6.20 Plan — Citizen Mobile PWA Parity

Status: **closed** — signed off 2026-05-19. Exit: [`master-sprint-620-exit.md`](./master-sprint-620-exit.md).

**Parent programme:** [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) §6.20 · **Mandatory gate before Phase 7**.

**Prerequisite:** Sprint **6.19** closed (State Admin + Citizen PWA + Tenant Admin web smoke). Partial mobile theme work from 6.19 is a baseline only — **not** sufficient for sign-off.

## Problem statement

`apps/mobile` (Expo SDK 52) today is a **linear** flow (Splash → Tenant picker → OTP → simple Home). The **Citizen PWA** (`:3000`) is the product reference: **central hub** after OTP, pinned municipalities, KPI strip, Shortcuts tab, and full workspace (services, apply, applications, payments, grievances) with **Tricolor Calm + per-ULB `applyTenantTheme`**.

Sprint **6.19** deferred mobile smoke because of Expo Go SDK mismatch, web bundling (`react-native-web`, Metro `.js`→`.ts` resolution), CORS for `:8081`, and missing hub/feature parity.

## Goal

Deliver **`@enagar/mobile`** as a **functional and visual peer** of the Citizen PWA for citizen journeys — same hub model, same API contracts, same theme system — on **iOS/Android** (and optional Expo web for dev smoke).

**Phase 7 (Sahayak AI) does not start until this sprint exits.**

## Reference surface (source of truth)

| Area      | PWA reference                                                     | Mobile today                                      |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| Auth      | OTP → preferences pin                                             | OTP only; no hub pins                             |
| Hub       | `CitizenHubNavigation`, KPI grid, pinned ULBs, Browse all         | Single-tenant home screen                         |
| Shortcuts | Pins + favourite service pairs                                    | Missing                                           |
| Workspace | Per-ULB tabs: services, apply, applications, payments, grievances | Partial lists/composers exist; not hub-integrated |
| Theme     | `applyPlatformTheme` / `applyTenantTheme`, B+ Pro tokens          | Partial picker/OTP/home tint                      |
| APIs      | Hub dashboard, preferences, scoped headers                        | Tenant list + OTP + some module APIs              |

Read: [`apps/citizen-pwa/README.md`](../../apps/citizen-pwa/README.md), [`docs/runbooks/citizen-unified-hub.md`](./citizen-unified-hub.md), [`apps/mobile/README.md`](../../apps/mobile/README.md).

## Design direction

- **Parity over novelty:** Reuse `@enagar/i18n`, `@enagar/forms` (`platform: 'native'`), `@enagar/tenant-theme`, and align copy/flows with PWA — not a separate mobile IA.
- **Hub-first:** After OTP, citizen lands on **hub** (not municipality home) until they enter a ULB workspace.
- **Themes:** Platform Warm Coral on hub/auth; ULB `theme_color` in workspace; match `tricolor-calm.css` semantic tokens where RN allows.
- **No API drift:** Consume existing `/api/citizen/*`, `/api/tenants`, `/api/services/*`, `/api/applications/*`, etc. — mobile-only UI/navigation changes unless a documented gap requires a minimal API addition (discourage).

## Deliverables

### D1 — Engineering foundation (Expo + monorepo)

| Item         | Acceptance                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------- |
| Dependencies | `react-native-web`, `react-dom`, `@expo/metro-runtime`; `expo-secure-store` SDK-aligned       |
| Metro        | Workspace package `.js` imports resolve to `.ts` (`@enagar/tenant-theme`, `@enagar/forms`, …) |
| Env          | `apps/mobile/.env.example` + documented `EXPO_PUBLIC_API_BASE_URL`; CORS `8081` in infra      |
| Dev paths    | Document Expo Go **SDK 52** vs upgrade path; emulator `10.0.2.2`; LAN IP for devices          |
| CI           | `pnpm --filter @enagar/mobile typecheck` (+ optional `expo export` smoke) green               |

### D2 — Central citizen hub (PWA parity)

| Item                  | Acceptance                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Hub screen            | Post-OTP **hub** with tab nav aligned to PWA: Home, Shortcuts, Services, Apply, Applications, Payments, Grievances |
| KPI strip             | `GET /citizen/dashboard` summary visible on hub home                                                               |
| Pinned municipalities | `GET/PATCH /citizen/preferences` — pin ≤15 ULBs; pinned cards on hub home                                          |
| Browse all            | Full tenant list modal/screen → enter workspace                                                                    |
| Back to hub           | Workspace “back” clears ULB scope and restores platform theme                                                      |
| Shortcuts tab         | Edit pins + pinned service pairs (match PWA behaviour)                                                             |

### D3 — Municipality workspace

| Item             | Acceptance                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| Workspace chrome | Header with ULB name/code, brand surface, back to hub                    |
| Services         | Catalogue `GET /services/tenants/:code`                                  |
| Apply            | `ApplicationComposerScreen` wired from hub/services; API-published forms |
| Applications     | List + detail + timeline/comments                                        |
| Payments         | List + stub initiate/complete where PWA does                             |
| Grievances       | List, create, detail (existing 5.2a flows integrated into hub IA)        |
| Theme            | `applyTenantTheme(selectedTenant)` on workspace mount                    |

### D4 — Auth & onboarding alignment

| Item          | Acceptance                                                          |
| ------------- | ------------------------------------------------------------------- |
| OTP           | Same dev/prod rules as PWA (`DEV_OTP_CODE`, tenant list before OTP) |
| Register      | `POST /citizen/register` after verify (fire-and-forget)             |
| First session | Prompt to pin ≥1 municipality when preferences empty (PWA rule)     |
| Locale        | Session locale from `@enagar/i18n` on hub + workspace               |

### D5 — Visual polish (B+ Pro)

| Item          | Acceptance                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Tokens        | Canvas/surface/ink/warm-border; no orphan legacy hex (`#0F4C75` defaults removed except fallbacks) |
| Components    | Shared patterns where feasible (cards, KPI tiles, primary CTAs) — RN-styled, PWA-equivalent        |
| Empty/error   | Reuse i18n status strings; retry affordances on API failures                                       |
| Accessibility | Touch targets, focus visible on web; screen titles                                                 |

### D6 — Contracts & documentation

| Item          | Acceptance                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------ |
| Security spec | `tests/security/master-sprint-620.spec.ts` — hub routes in mobile, no accidental API drift |
| Exit runbook  | Manual smoke matrix (device + optional web)                                                |
| Help          | `start-the-app-step-by-step.md` — mobile hub section                                       |
| README        | `apps/mobile/README.md` — hub parity scope, dev matrix                                     |

## Non-goals

- Tenant Admin, State Admin, or Desk on mobile.
- Expo SDK 54 upgrade unless required for store/Expo Go — prefer **SDK 52 + dev client** or documented Go 52 install.
- Dark mode, Sahayak AI chatbot (Phase 7).
- Push notifications parity beyond existing 5.4 hooks unless trivial.
- Pixel-perfect match to every PWA edge case (e.g. PWA install banner) — **functional + thematic** parity is the bar.

## Suggested implementation order

1. **D1** — unblock bundling and dev workflow.
2. **D2** — hub shell + preferences + dashboard KPIs (navigation skeleton).
3. **D4** — OTP → hub routing; first-pin flow.
4. **D3** — wire existing screens into workspace tabs.
5. **D5** — token sweep + UX polish pass.
6. **D6** — smoke, spec, docs.

## Verification

```bash
pnpm --filter @enagar/mobile typecheck
pnpm --filter @enagar/mobile lint
pnpm --filter @enagar/mobile test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-620.spec.ts
graphify update .
```

## Manual smoke

Stack: API `:3001`, `pnpm db:seed`, `DEV_AUTH_ENABLED`, OTP **`12345`**.  
`apps/mobile/.env`: `EXPO_PUBLIC_API_BASE_URL` (localhost / `10.0.2.2` / LAN).

| #   | Scenario                                                | Device                     |
| --- | ------------------------------------------------------- | -------------------------- |
| 1   | App launches; tenant list loads                         | Emulator or Expo Go SDK 52 |
| 2   | OTP → **hub** (not legacy single home)                  | Same                       |
| 3   | Pin municipality; hub home shows pinned card + KPIs     | Same                       |
| 4   | Enter KMC workspace; brand colour on chrome             | Same                       |
| 5   | Services → Apply birth-cert (or seed service) → submit  | Same                       |
| 6   | Applications list + detail                              | Same                       |
| 7   | Payments list (+ stub pay if seeded)                    | Same                       |
| 8   | Grievance create + list                                 | Same                       |
| 9   | Back to hub; platform theme restored                    | Same                       |
| 10  | Shortcuts tab: edit pins / favourites                   | Same                       |
| 11  | Compare side-by-side with PWA `:3000` same user journey | Laptop + device            |
| 12  | (Optional) Expo web `:8081` — hub + picker after CORS   | Browser                    |

## Exit criteria

| #   | Criterion                                                 | Evidence               |
| --- | --------------------------------------------------------- | ---------------------- |
| E1  | Hub navigation matches PWA tab set                        | Code + smoke #2–3, #10 |
| E2  | Workspace features parity (services/apply/apps/pay/griev) | Smoke #4–8             |
| E3  | Theme: platform hub + tenant workspace                    | Smoke #3–4, #9, #11    |
| E4  | Dev workflow documented (SDK 52, env, CORS)               | README + help          |
| E5  | typecheck / lint / security spec green                    | CI / local             |
| E6  | No unintended `/api/*` contract changes                   | 620 spec               |
| E7  | Manual smoke Pass on **real device or emulator**          | Exit runbook           |

## Phase gate

**Sprint 6.20** is the **last UX gate before Phase 7**. On exit, update [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md) and [`ROADMAP.md`](../../ROADMAP.md) to allow Sahayak AI implementation.
