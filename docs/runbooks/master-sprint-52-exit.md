# Master Phase 5 — **Sprint 5.2a** exit (**locked queue #5**, engineering slice)

**Status: closed — engineering (repo)** · **2026-05-14**  
_ROADMAP pointer: [`ROADMAP.md` § Locked queue](../../ROADMAP.md#locked-sprint-queue-priority-order-114)._

Master **ROADMAP** row **Sprint 5.2** listed “RN apply / payments / grievance flows + offline drafts.” This sprint delivers the **engineering subsprint `5.2a`**: **OTP parity**, **grievances** (list / create / detail) against **`/grievances`** with **`Authorization: Bearer …`** plus **`x-enagar-tenant-code`** (municipality **code**, e.g. KMC), and **offline composer drafts** persisted with the shared **`@enagar/forms`** draft envelope helpers.

**Continuation:** native **Apply + payments** landed in **Sprint `5.2b`** — [`master-sprint-52b-exit.md`](./master-sprint-52b-exit.md).

**Explicit deferrals:** Detox/Maestro, push/deep-links (Master **5.4**); PWA/forms parity spine (**5.3**).

_CI on closure: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:security` (all green **2026-05-14**)._

---

## Deliverables (`5.2a`)

| Area                  | What shipped                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation**        | `@react-navigation/native` + native stack; **`CitizenNavigator`** (`Splash → TenantPicker → OtpLogin → Home → grievance screens`).                                                                                  |
| **Session + storage** | **`SessionProvider`**: restores **access JWT + mobile digits + persisted municipality JSON** (`AsyncStorage`), tokens in **SecureStore** (native) / AsyncStorage (`web`). **Sign-out** on municipality change path. |
| **Auth APIs**         | `sendOtp` / `verifyOtp` — **omit** OTP `tenant_code` when absent (portal default on API — do **not** send ULB code as OTP `tenant_code`).                                                                           |
| **Grievances**        | List / POST create / GET detail wired to **`/grievances`** / **`/grievances/:id`**, bearer + **`x-enagar-tenant-code`**.                                                                                            |
| **Offline drafts**    | Composer autosave keyed in AsyncStorage; envelope types **`MOBILE_GRIEVANCE_DRAFT_SCHEMA`**, **`FormDraftEnvelope`**, **`parseFormDraftJson`** in **`@enagar/forms`**.                                              |
| **Regression**        | `tenantApi.selftest.ts` retained; **`@enagar/forms`** **`test/run-tests.mjs`** covers envelope round-trip.                                                                                                          |

---

## Exit criteria

- [x] **Thin `CitizenShell`**: **`SessionProvider` → `NavigationContainer` → `CitizenNavigator`** (audited flows in **`navigation/types.ts`** **`CitizenShellFlowContract`**).
- [x] **Security contract** `citizen-onboarding.spec.ts` updated for **`5.2a`** (flow types file + **`CitizenNavigator`** wiring).
- [x] **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`** succeed.
- [x] **`ROADMAP.md`**, **`ARCHITECTURE.md`**, **`apps/mobile/README.md`** reference **`5.2a`** closure; **`5.2b`** — [`master-sprint-52b-exit.md`](./master-sprint-52b-exit.md).

### Sign-off

| Role          | Notes                | Date           |
| ------------- | -------------------- | -------------- |
| Product owner | _(optional sponsor)_ |                |
| Engineering   | Repo CI verification | **2026-05-14** |
