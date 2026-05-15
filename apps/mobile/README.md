# @enagar/mobile — Citizen (Expo)

React Native + **Expo SDK 52** citizen app — **Master Sprint 5.1** shell, **`5.2a`** grievances/auth (`docs/runbooks/master-sprint-52-exit.md`), **`5.2b`** catalogue / apply / applications / stub payments (`docs/runbooks/master-sprint-52b-exit.md`), **`5.4`** push + deep links (`docs/runbooks/master-sprint-54-exit.md`).

**Flow**

- **Splash** (session restore → **Home**, or timed → tenant picker).
- **`GET /tenants`** (public manifest) on **Tenant picker** (`TenantPickerScreen`) — selects municipality (**`code`** drives **`x-enagar-tenant-code`** on workspace-scoped API calls).
- **OTP** (`/auth/send-otp`, `/auth/verify-otp`) — **omit** OTP `tenant_code` in payloads (portal default on API — do **not** send municipality code here).
- **Home** (`HomeScreen`) → **Browse services** (`GET /services/tenants/:code`), **My applications**, **My payments**; **Grievances** list/create/detail (**`/grievances`**, Bearer + **`x-enagar-tenant-code`**).
- **Apply** (`ApplicationComposerScreen`): **`@enagar/forms/fixtures`** → **`createRenderPlan`** with **`platform: 'native'`** (`DynamicFormFields`) → draft PATCH → **`/documents/upload-intents`** simulated clean scan (`finalizeDraftDocumentsMobile`) → **`/submit`** (no empty JSON body on submit).
- **Application detail**: timeline/comments; fixed-fee **`/payments/initiate`** + **`x-idempotency-key`** + **`/payments/stub/complete`** (tenant + application scope, mirroring Citizen PWA).
- **OTP verify** → **`POST /citizen/register`** (same fire-and-forget pattern as PWA).
- **Offline** grievance composer autosave (**AsyncStorage** + **`@enagar/forms`** draft envelope).

Shares **`@enagar/i18n`**, **`@enagar/forms`**, **`@enagar/tenant-theme`** with other citizen surfaces.

**Config**

`EXPO_PUBLIC_API_BASE_URL` — optional absolute API root (**must** include `/api`). Example:

`http://10.0.2.2:3001/api` (Android emulator → host `localhost`)

## Dev

From repo root (`pnpm-workspace.yaml`):

```powershell
pnpm --filter @enagar/mobile install
pnpm --filter @enagar/mobile dev          # expo start ; press `a` / `i`
```

Run **`@enagar/api`** (`localhost:3001` default) with seeded tenants — otherwise the picker shows offline/error strings from **`@enagar/i18n`**.

**Tests:** `pnpm --filter @enagar/mobile run test` → `tenantApi.selftest.ts` (`tsx`). Root CI: **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`**.

Exit records: **`docs/runbooks/master-sprint-51-exit.md`**, **`docs/runbooks/master-sprint-52-exit.md`** (**5.2a**), **`docs/runbooks/master-sprint-52b-exit.md`** (**5.2b**). ADR‑0003 dual-surface sequencing vs locked-queue ordering is noted in **`master-sprint-51-exit.md`**.
