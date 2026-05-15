# Master Phase 5 — **Sprint 5.1** exit (locked queue **#4**)

**Status: closed — engineering (repo)** · **2026-05-14**  
_ROADMAP pointer: [`ROADMAP.md` § Locked queue](../../ROADMAP.md#locked-sprint-queue-priority-order-114)._  
_ADR: [ADR-0003](../ADRs/ADR-0003-mobile-pwa-parallel.md) — dual citizen surfaces; sequencing note defers RN polish to **5.3** where staffing is constrained; **`ROADMAP` locked-queue Sprint 5.1 is RN-first (`Splash → Tenant → Home`)**, so **this sprint follows `ROADMAP` scope**._

_CI on closure: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:security` (all green on **2026-05-14**). Mobile: `pnpm --filter @enagar/mobile run lint` (via turbo)._

**Toolchain notes (this closure):** Root **`.npmrc`** sets `public-hoist-pattern[]=!ajv` so ESLint 8’s `@eslint/eslintrc` resolves **Ajv 6** (hoisted **Ajv 8** from other tools previously broke `@typescript-eslint` load with `missingRefs`). Root **`package.json` → `pnpm.overrides`** pins `eslint>ajv` / `@eslint/eslintrc>ajv` to **6.12.6** and **`@typescript-eslint/*`** to **8.43.0** (aligns with Next `eslint-config-next` and **TypeScript 5.9** peer range). Security contract specs read **`apps/mobile/src/CitizenShell.tsx`** instead of the removed stub `src/index.ts`.

**Known peer noise (non-blocking):** `pnpm install` may warn on **`apps/api`** (`react-dom` 18 vs hoisted **React 19** from Prisma Studio’s UI stack). Does not affect API runtime (no React in the Nest server bundle).

## Deliverables

| Area                   | What landed                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **RN + Expo scaffold** | `apps/mobile` is a managed **Expo SDK 52** app (`app.json`, `babel.config.js`, `metro.config.js` monorepo wiring) targeting **Android / iOS** (and optional `web` entry via Expo).                                       |
| **Shell navigation**   | **Splash** (timed **2.4s** advance + tap-to-continue) → **tenant list** (`GET {api}/tenants`, public) → **themed Home** (empty-shell copy from `@enagar/i18n`; ward count + language toggle + SecureStore probe banner). |
| **Shared packages**    | **`@enagar/i18n`**, **`@enagar/tenant-theme`** (`hexToRgb`), **`@enagar/types`** workspace stub for future parity.                                                                                                       |
| **Configuration**      | `EXPO_PUBLIC_API_BASE_URL` (optional) — defaults to `http://localhost:3001/api` (physical devices need LAN IP — see **`apps/mobile/README.md`**).                                                                        |
| **Regression harness** | `src/tenantApi.selftest.ts` — deterministic **`fetch`** doubles executed via **`tsx`** (`pnpm --filter @enagar/mobile run test`).                                                                                        |

**Explicit deferrals (per ROADMAP 5.2+):** login / OTP, apply & payment flows, offline drafts (`packages/forms`), PWA Lighthouse gate, Detox / Maestro native E2E, push/deep-links — **Master Sprints 5.2–5.4.**

## Exit criteria

- [x] **Engineering artefacts merged** (`apps/mobile` no longer Phase-0 echo stub).
- [x] **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`** succeed (closure run **2026-05-14**).
- [x] **`ROADMAP.md`**, **`ARCHITECTURE.md`**, **`apps/mobile/README.md`** updated with Sprint **5.1** pointer + smoke notes.

### Sign-off

| Role          | Notes                | Date           |
| ------------- | -------------------- | -------------- |
| Product owner | _(optional sponsor)_ |                |
| Engineering   | Repo CI verification | **2026-05-14** |
