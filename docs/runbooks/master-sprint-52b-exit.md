# Master Phase 5 — **Sprint 5.2b** exit (native Apply + stub payments)

**Status: closed — engineering (repo)** · **2026-05-14**  
_Parent queue item: **#5 — Sprint 5.2** (with **5.2a** [`master-sprint-52-exit.md`](./master-sprint-52-exit.md))._

This subsprint completes the **remaining ROADMAP Sprint 5.2 scope on React Native**: **service catalogue**, **`@enagar/forms`** dynamic apply (**`createRenderPlan`** with **`platform: 'native'`**), **`/applications`** lifecycle mirroring the Citizen PWA (**draft → simulated document scan → submit**), **payments stub rail** (**`/payments/initiate`** + **`/payments/stub/complete`** with **`idempotency-key`**), and **`POST /citizen/register`** after OTP verification (PWA parity).

_CI on closure: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:security` (all green **2026-05-14**)._

---

## Deliverables

| Area           | What shipped                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation** | **`ServiceCatalog`**, **`ApplicationComposer`**, **`ApplicationList`**, **`ApplicationDetail`**, **`PaymentList`** routes on **`CitizenNavigator`**. |
| **HTTP**       | **`citizenTenantFetch`** + **`x-enagar-tenant-code`** on workspace-scoped reads/writes (applications, documents, payments lists).                    |
| **Forms**      | Fixture schemas from **`@enagar/forms/fixtures`**; **`DynamicFormFields`** maps render-plan widgets to RN.                                           |
| **Payments**   | Stub initiation + simulated PSP capture; INR formatting on list/detail.                                                                              |
| **i18n**       | New **`services.*`**, **`applications.*`**, **`apply.*`**, **`dossier.*`**, **`payments.*`**, **`home.servicesCta`** keys (**en/bn/hi**).            |

---

## Exit criteria

- [x] Citizen can **browse** `GET /services/tenants/:code`, **compose** a fixture-backed service, **submit** through the API document gate, and **pay** via stub rail when `fee_type === 'fixed'`.
- [x] **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`** succeed.
- [x] **`ROADMAP.md`**, **`ARCHITECTURE.md`**, **`apps/mobile/README.md`** updated; **5.2** queue row documents **5.2a + 5.2b**.

### Sign-off

| Role          | Notes                | Date           |
| ------------- | -------------------- | -------------- |
| Product owner | _(optional sponsor)_ |                |
| Engineering   | Repo CI verification | **2026-05-14** |
