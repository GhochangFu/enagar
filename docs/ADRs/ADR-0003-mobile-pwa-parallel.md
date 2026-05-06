# ADR-0003 — Citizen surface sequencing: PWA + React Native in parallel from Phase 5 (with a PWA-first lead recommended for solo execution)

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Status**          | Accepted (with sequencing recommendation for solo phase) |
| **Date**            | 2026-05-06                                               |
| **Decision-makers** | Project Technical Lead                                   |
| **Related**         | ADR-0002 (Backend), Charter §9 (Schedule reality check)  |

## Context

`ARCHITECTURE.md` §1 specifies React Native + Expo as the citizen mobile surface. The existing prototype (`MunicipalApp.jsx`, `index.html`) is implemented in **web** React (Tailwind + Lucide). This is a tension: the architecture is mobile-first, the mockup is web-first.

Citizens in West Bengal access digital services via a wide spectrum of surfaces:

- **Mobile-first**: Mid- to low-tier Android phones (≥ 70 % of users by volume).
- **Web on shared phones / kiosks / CSCs (Common Service Centres)**: ≈ 15 % of users, often in rural blocks.
- **Desktop / laptop**: Power users, organisations applying for tenders / trade licences / building plans.

Building only one surface leaves a meaningful citizen segment under-served.

The decision-maker selected "Both in parallel from Phase 5" in the Phase 0 kick-off, which ratifies the architecture's intent without abandoning the prototype.

## Decision

**We build both a Citizen PWA (Next.js 14 App Router) and a Citizen Mobile App (React Native + Expo). Both are scaffolded in Phase 0; both go to pilot in Phase 5.**

The PWA and the RN app share these packages:

- `packages/sdk` — typed API client
- `packages/forms` — JSON-Schema-based form renderer (web + RN parity)
- `packages/i18n` — message catalogues + helpers
- `packages/types` — domain types
- `packages/workflow` — workflow schema
- `packages/tenant-theme` — runtime theming utility

UI components are mirrored between `packages/ui` (web; Tailwind + shadcn/ui) and `packages/ui-native` (RN; NativeWind). Same prop API where possible; different rendering primitives.

### Sequencing recommendation (for the current solo contributor model — non-binding architecturally)

For solo execution, the literal "in parallel" reading would have one developer building two apps simultaneously, which is not realistic. We instead recommend a **lead-and-follow** pattern within Phase 5:

1. **Sprint 5.1 + 5.2**: PWA built from the existing prototype (~4 weeks). All shared packages (`forms`, `sdk`, `i18n`, `types`, `tenant-theme`) reach maturity here, because the PWA exercises them.
2. **Sprint 5.3**: RN port — screens are re-implemented using `packages/ui-native`, but business logic (form rendering, validation, navigation state, API calls, i18n, theming) is reused 1:1 from the shared packages. RN port estimated at ~2 weeks because the heavy lifting was done in 5.1/5.2.
3. **Sprint 5.4**: Both surfaces hardened together (offline drafts, push, deep links, accessibility, perf).

Both apps still ship for pilot. The architecture stays unchanged; only the within-phase ordering is honest about who is doing the work.

If/when more contributors join, this sequencing collapses naturally into true parallelism (one engineer per surface).

## Alternatives considered

| Option                                           | Pros                                         | Cons                                                                                                                                                           | Rejected because                                                                  |
| ------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **PWA-only for v1; RN deferred to v1.5**         | Simplest solo path; ~4 weeks faster to pilot | Excludes the segment of citizens who prefer / only use a native app; loses Play Store / App Store discoverability; native push notifications limited           | Decision-maker opted for both; native install is too valuable to defer past pilot |
| **RN-first** (per the literal architecture text) | Matches mobile-first principle               | Throws away the head start the existing prototype gives us; shared packages would mature on RN-only first, then need re-validation on web                      | The prototype is an asset; using it accelerates the PWA                           |
| **One codebase via Expo Web**                    | One technology, two outputs                  | Expo-Web-on-the-PWA-side underperforms a native Next.js app on SEO, kiosk mode, deep linking, performance budget on desktop; UX compromises in both directions | The dual-render isn't actually a single codebase — the trade-offs accumulate      |
| **Capacitor-wrap-the-PWA**                       | One codebase                                 | Loses native feel, native gestures, push fidelity, biometric auth, offline DB story                                                                            | Inferior native experience                                                        |
| **Flutter**                                      | True one codebase, native                    | Throws away the entire prototype; smaller talent pool in WB; loses TypeScript end-to-end                                                                       | Sunk cost in prototype + ADR-0002 alignment                                       |

## Consequences

### Positive

- Coverage of every meaningful citizen surface from pilot day one.
- Shared packages forced to be UI-framework-agnostic, which is good architecture hygiene.
- The PWA serves as the _production_ form of the existing prototype — the prototype's UX investment is preserved.
- Field officers, kiosks, CSC operators, and desktop power users all have a first-class web surface.

### Negative / costs

- Two app stores' release dance (Play Store + App Store) on top of PWA deployment.
- Two test suites (Playwright for PWA, Detox for RN).
- Two design-system trees (`packages/ui` + `packages/ui-native`).
- For solo: Phase 5 is the most loaded phase. Charter §9 already flags this. The MVP cut in Charter §9 explicitly proposes deferring RN to v1.5 if the solo timeline becomes critical.

### Neutral / follow-ups required

- **Phase 5 follow-up**: pick a strategy for shared icon library (Lucide on web, lucide-react-native on RN — already aligned).
- **Phase 5 follow-up**: shared deep-link spec covering `https://app.enagarseba.wb.gov.in/...` for PWA and `enagarseba://...` custom scheme for RN.
- **Phase 5 follow-up**: shared push-notification topic naming (FCM topic per tenant + per citizen), so a single notification worker can fan out to PWA Web Push and RN FCM/APNs.

## Compliance / verification

- **`packages/forms`, `packages/sdk`, `packages/i18n`, `packages/types`, `packages/tenant-theme`** must remain UI-framework-agnostic. Lint rule: no imports from `react-dom`, `react-native`, `next`, `expo` inside these packages. CI fails otherwise.
- **PWA Lighthouse PWA score ≥ 90** in CI on every PR touching `apps/citizen-pwa`.
- **RN app passes Detox happy-path E2E** in CI.
- **Visual parity**: Storybook hosts both `packages/ui` and `packages/ui-native` stories side-by-side; designer reviews divergence weekly during Phase 5.

## References

- `ARCHITECTURE.md` §1 — Open-source stack rationale
- `ROADMAP.md` Phase 5 — Citizen Mobile + PWA Polish
- Charter §9 — Schedule Reality Check (solo MVP cut)
- Existing prototype: `index.html`, `MunicipalApp.jsx`
