# Master Phase 5 — **Sprint 5.4** exit (locked queue **#7**)

**Status: closed — engineering (repo)** · **2026-05-15**  
_ROADMAP pointer: [`ROADMAP.md` § Locked queue](../../ROADMAP.md#locked-sprint-queue-priority-order-114)._

This sprint delivers **push registration**, **deep links**, **PWA installability (manifest + SW)**, **Lighthouse CI gates**, **store-listing copy**, and **baseline mobile a11y labels** across the dual citizen surfaces.

---

## Subsplit (execution)

| Subslice | Delivered                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5.4a** | **`citizen_push_devices`** table + RLS · **`POST /api/citizen/notifications/push-token`** · Expo **`expo-notifications`** registration + notification tap → **`data.deepLink`** URL |
| **5.4b** | **`enagarseba://` scheme** + React Navigation **`linking`** (`grievance/:id`, `application/:docketNo`, …)                                                                           |
| **5.4c** | PWA **`manifest.ts`**, **`/sw.js`**, dynamic **`/icon`**, query deep links **`?grievance=` / `?application=`**, optional **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`** web push registration   |
| **5.4d** | **`quality-gates.mjs`** (Lighthouse a11y / perf / best-practices floors) · **CI** step after **`pnpm build`**                                                                       |

---

## Exit criteria

- [x] **Push:** Native clients POST Expo push token after permission; API persists rows in **`citizen_push_devices`** (unique per citizen + token). Web push registers when VAPID env is set.
- [x] **Deep links:** Documented URL schemes + hub/workspace query params open grievance detail or application dossier when the citizen session is active.
- [x] **PWA:** Valid **manifest**, **service worker**, **icons**; **Lighthouse** gates in CI (defaults: a11y ≥ 0.88, perf ≥ 0.55, best-practices ≥ 0.85 — tunable via `PWA_*` env in workflow).
- [x] **Store metadata:** Pilot copy in [`docs/store-listing/`](./store-listing/).
- [x] **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`** succeed.
- [x] **`ARCHITECTURE.md`**, **`ROADMAP.md`**, **`README.md`**, **`apps/mobile/README.md`**, **`apps/citizen-pwa/README.md`**, **`docs/help/start-the-app-step-by-step.md`** cite **Sprint 5.4**.

### Deferred (roadmap owners unchanged)

- **Detox / Maestro** native E2E hard gate.
- **notification-worker** FCM/APNs/Web Push fan-out to registered devices (storage now ready).
- **iOS universal links** / **Android App Links** asset association files in hosted `/.well-known` (needs pilot host).

### Sign-off

| Role          | Notes                | Date           |
| ------------- | -------------------- | -------------- |
| Product owner | _(optional sponsor)_ |                |
| Engineering   | Repo CI verification | **2026-05-15** |
