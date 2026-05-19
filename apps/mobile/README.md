# @enagar/mobile — Citizen (Expo)

React Native + **Expo SDK 52** citizen app — **Master Sprint 5.1** shell, **`5.2a`** grievances/auth (`docs/runbooks/master-sprint-52-exit.md`), **`5.2b`** catalogue / apply / applications / stub payments (`docs/runbooks/master-sprint-52b-exit.md`), **`5.4`** push + deep links (`docs/runbooks/master-sprint-54-exit.md`), **`6.6`** DB-published catalogue/forms (`docs/runbooks/master-sprint-66-exit.md`).

**Flow** (Master Sprint **6.20** — Citizen PWA hub parity)

- **Splash** → session restore → **Citizen hub**; otherwise timed → **OTP login** (portal identity, API default `WBPORTAL`).
- **OTP** (`/auth/send-otp`, `/auth/verify-otp`) — omit municipal `tenant_code` in payloads; **`POST /citizen/register`** after verify.
- **First session** → **Pin municipalities** (`PATCH /citizen/preferences`, ≥1 ULB) when pins empty.
- **Citizen hub** (`CitizenHubScreen`) — tabs aligned with PWA: Home, Shortcuts, Services, Apply, Applications, Payments, Grievances; **`GET /citizen/dashboard`** KPI strip; pinned ULB cards; **Browse all**.
- **Workspace** (`WorkspaceScreen`) — per-ULB chrome, **`POST /citizen/select-tenant`**, **`x-enagar-tenant-code`** on scoped APIs; back to hub clears ULB + restores platform theme.
- **Tenant picker** — optional preview before login; hub pins replace pre-auth municipality selection.
- Legacy **Home** screen retained for deep links only.
- **Apply** (`ApplicationComposerScreen`): API-published `form_schema` from **`GET /services/tenants/:code/:serviceCode`** → **`createRenderPlan`** with **`platform: 'native'`** (`DynamicFormFields`) → draft PATCH → **`/documents/upload-intents`** simulated clean scan (`finalizeDraftDocumentsMobile`) → **`/submit`** (no empty JSON body on submit).
- **Application detail**: timeline/comments; fixed-fee **`/payments/initiate`** + **`x-idempotency-key`** + **`/payments/stub/complete`** (tenant + application scope, mirroring Citizen PWA).
- **OTP verify** → **`POST /citizen/register`** (same fire-and-forget pattern as PWA).
- **Offline** grievance composer autosave (**AsyncStorage** + **`@enagar/forms`** draft envelope).

Shares **`@enagar/i18n`**, **`@enagar/forms`**, **`@enagar/tenant-theme`** with other citizen surfaces.

**Visual system (Sprint 6.20)** — Tricolor Calm mobile tokens in `src/theme/citizenMobileTheme.ts` (warm canvas `#FAF7F4`, coral platform brand, mint KPI bands, forest metrics). Reusable chrome in `src/components/ui/MobileChrome.tsx` (`MobileHubHero`, `MobilePanel`, primary/secondary buttons, safe-area scroll shells). Hub widgets under `src/components/hub/`.

**Config**

`EXPO_PUBLIC_API_BASE_URL` — optional absolute API root (**must** include `/api`). Example:

`http://10.0.2.2:3001/api` (Android emulator → host `localhost`)

**Expo Go on a phone** (`exp://192.168.x.x:8081`): `localhost` in the API URL is the **phone**, not your PC. Either set `EXPO_PUBLIC_API_BASE_URL=http://<your-pc-lan-ip>:3001/api` in `apps/mobile/.env`, or keep `http://localhost:3001/api` and let `sessionApiRoot()` rewrite it to Metro’s LAN host (`src/lib/devApiBase.ts`). Restart Expo after changing `.env` (`pnpm --filter @enagar/mobile dev -- --clear`). Confirm from the PC: `curl http://<lan-ip>:3001/health`.

## Dev

From repo root (`pnpm-workspace.yaml`):

```powershell
pnpm --filter @enagar/mobile install
pnpm --filter @enagar/mobile dev          # expo start ; press `a` / `i`
```

Run **`@enagar/api`** (`localhost:3001` default) with seeded tenants and published service forms (`pnpm db:seed`) — otherwise the picker/service catalogue shows offline/error strings from **`@enagar/i18n`**.

**Expo Web** runs on **`http://localhost:8081`** — the API must allow that origin in CORS (`CORS_ORIGIN` in `infrastructure/.env`, or the default list in `apps/api/src/main.ts`). If the picker shows “API is unreachable” on **web** while `http://localhost:3001/health` works, add `http://localhost:8081` to `CORS_ORIGIN` and restart the API. On **Expo Go (device)**, CORS does not apply; fix the API host (LAN IP / auto-rewrite above), not CORS.

**Tests:** `pnpm --filter @enagar/mobile run test` → `tenantApi.selftest.ts` (`tsx`). Root CI: **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`**.

Exit records: **`docs/runbooks/master-sprint-51-exit.md`**, **`docs/runbooks/master-sprint-52-exit.md`** (**5.2a**), **`docs/runbooks/master-sprint-52b-exit.md`** (**5.2b**), **`docs/runbooks/master-sprint-66-exit.md`** (**6.6**). ADR‑0003 dual-surface sequencing vs locked-queue ordering is noted in **`master-sprint-51-exit.md`**.
