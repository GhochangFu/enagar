# @enagar/citizen-pwa

Citizen-facing **Progressive Web App** built on **Next.js 14** App Router (per ADR-0003).

**Hub operations (scope headers, dashboard):** [`docs/runbooks/citizen-unified-hub.md`](../../docs/runbooks/citizen-unified-hub.md) · **H6.1 exit checklist:** [`docs/runbooks/hub-h6-exit-checklist.md`](../../docs/runbooks/hub-h6-exit-checklist.md).

## Current surface

- **Onboarding (Phase 1 + 4.x hub):** splash → language → mobile OTP (**`tenant_code: WBPORTAL`**) → **pin ≥1 municipality** (first session) via **`PATCH /citizen/preferences`** → **Citizen hub** (Sprint 4.15/4.16 KPI strip & tabs): **`GET /citizen/dashboard`** (includes **`distinct_active_service_codes`** for the whole catalogue union), **`GET /tenants`**, **`GET /citizen/preferences`**, unscoped **`GET /applications`** + **`GET /payments`**, and **lazy** **`GET /services/tenants/{code}`** only for pinned + shortcut ULBs; hub **Home** shows the pinned row plus **Browse all**; **Shortcuts** tab edits pins (≤15) and favourite `{ tenant_code, service_code }` pairs (**independent** of **`POST /citizen/select-tenant`**). **`PATCH /citizen/language`** after OTP; Language KPI = session locale. Municipality workspace behaviour unchanged (scoped header after pick).
- **Hub ↔ workspace:** **Back to hub** clears workspace selection and resets branding to defaults; dashboard cards show per‑ULB application / payment / grievance counts and theme badges.
- **Services & applications (Phase 2 + Sprint 5.3 spine + 5.4 PWA + 6.6):** tenant catalogue, **`createRenderPlan`** (**`platform: 'web'`**) via **`@enagar/forms/web`** (`DynamicFormFields` on **`@enagar/ui`**), draft → document scan simulation → submit, **My Applications** with detail + comments (writes include scope header when in workspace). Runtime form schemas come from API-published `service_form_versions`; **`lib/service-schemas.ts`** keeps dev smoke defaults only. **Installable PWA:** `app/manifest.ts`, `public/sw.js`, `app/icon.tsx`; deep links **`?grievance=`** / **`?application=`** (session required); optional **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`** for web push → **`POST /citizen/notifications/push-token`**.
- **Payments (Phase 3 stub rail):** initiate stub payment, simulate PSP capture, list payments, receipt metadata preview (**receipt GET** uses **ULB scope** from workspace or from the payment’s municipal tenant in hub).
- **Grievances (Phase 4 — Sprints 4.2 / 4.3 / backlog slice):** **Grievances** tab — profile gate (`/citizen/register` when needed), category + priority + description, optional **GPS pin fields** (`latitude` / `longitude` + text hints), optional **service alerts banner** (**unread SLA breach notifications** via **`GET /citizen/notifications`**), list/detail with SLA chips (+ **structured attachment metadata** list on detail when API returns **`attachments`**), timeline, comments, **re-open resolved cases within 7 days** (`POST …/reopen`), and **rating after resolved**. **Registers evidence:** `POST /grievances/:id/attachments/register` (after uploading binary elsewhere). Same hub vs workspace **`X-Enagar-Tenant-Code`** semantics as Sprint 4.2. Automated **`lib/grievance-scope.spec.ts`**.

Shared: Tailwind preset (`@enagar/config/tailwind/base`), **`@enagar/forms`**, **`@enagar/forms/web`**, **`@enagar/ui`**, `@enagar/i18n`, `@enagar/tenant-theme`. **Tailwind `content`** scans **`packages/ui/src`** and **`packages/forms/src/web`** (see `tailwind.config.ts`).

### Manual smoke — Sprint 5.3 (`@enagar/forms/web` + `@enagar/ui`)

1. **Automated:** root **`pnpm lint`** / **`pnpm typecheck`** — or scoped **`pnpm --filter @enagar/citizen-pwa run typecheck`**.
2. Municipal **workspace** → **Services** → **Apply** on a fixture service (e.g. birth certificate / property tax): choices render as **pills** (not legacy `<select>` only); **multi-select** schemas (if present) toggle multiple pills.
3. **DevTools → Network:** **`POST /applications/drafts`**, upload-intent simulation, **`POST …/submit`** unchanged from pre-5.3 API contract.
4. **Production build parity:** `pnpm --filter @enagar/citizen-pwa run build` — form controls keep **focus ring / border-brand** styles (confirms Tailwind **content** globs include shared packages).

### Manual smoke — Sprint 4.2 (grievances scope + regression)

1. **Automated:** `pnpm --filter @enagar/citizen-pwa run typecheck` and `pnpm --filter @enagar/citizen-pwa run test` (pure scope helpers).
2. **Hub:** From hub **Grievances** tab, open DevTools → Network → **`GET …/grievances`** must **not** include `x-enagar-tenant-code`.
3. **Hub detail:** Tap a grievance row → **`GET …/grievances/{no}`** **must** include **`x-enagar-tenant-code`** matching that row’s municipality (same ULB as card/theme expectation).
4. **Hub filing:** **File grievance** → pick municipality → submit → **`POST …/grievances`** carries picker ULB header; hub KPI/dashboard refresh does **not** loop flicker after returning to list (no repeated hub bootstrap storms).
5. **Hub comment / feedback:** On a detail view, post a comment and (if resolved) feedback; confirm POSTs send the **same** scope header as detail GET.
6. **Workspace:** Enter a municipality → **Grievances** → list/detail/create; all calls include **`x-enagar-tenant-code: {that ULB}`**.
7. **Regression:** Workspace **My Applications** / **My Payments** still scoped via **`workspaceLoadScope()`**; hub **applications/payments** aggregate calls still **omit** scope (Sprint 4.15 behaviour).

### Manual smoke — Sprint 4.3 (re-open resolved + SLA sweep MVP)

**Status: deferred** — run this block when **Keycloak (or IdP) admin/staff users** issue valid **staff JWTs** and **`PATCH /grievances/:id/status`** / **`POST …/staff/sweep-sla`** are confirmed against staging (see **`ROADMAP.md`** Hub **H5.1** / locked execution queue). Until then, use **DB-only fakes** for citizen-only paths or skip staff-dependent steps.

_Admin/API bits need a **staff bearer** with `municipality_clerk` (or higher) against the grievance tenant; PWA path follows the existing citizen OTP flow._

1. **Open → resolve → reopen (API or PWA):** File/track a grievance, use staff Swagger or SQL to advance `PATCH /grievances/:id/status` to **`resolved`** (`POST /citizen/register` gates still apply).
2. **Re-open banner:** Citizen detail should show **Re-open dispute** while `resolved` — submit optional reason — expect **`POST /grievances/{no}/reopen`** with the same **`X-Enagar-Tenant-Code`** behaviour as **`GET`** detail (**hub/workspace rules unchanged from Sprint 4.2**).
3. **State change:** Reload detail — **`status = under_review`**, **`resolved_at` cleared**, timeline shows **`reopen`**; SLA chips reset (new `sla_due_at`; breach flags cleared unless staff sweeps later).
4. **Close path still works:** After staff resolves again, **`POST …/feedback`** should still close to **`closed`** — confirm portal JWT works (Sprint **4.3** routes feedback through **`getById`**).
5. **SLA escalation (staff):** For an open grievance, `UPDATE grievances SET sla_due_at = NOW() - interval '1 day'` via SQL against your dev DB **or** fast-forward SLA in fixtures; call **`POST /grievances/staff/sweep-sla`** and confirm DB shows **`sla_breached_at` populated**, **`routed_role_code` escalated**, **`assigned_to_user_id = null`**, timeline rows **`sla_breach`** + **`sla_escalation`**, **`notifications` row** (**`type = sla_breach`**) for the owning citizen — second sweep skips already-breached rows; citizen **`GET /citizen/notifications`** returns the notice (Phase 4 backlog).

### Manual smoke — Phase 4 backlog slice (citizen SLA inbox + KPI + GPS stub)

_No staff JWT strictly required beyond optional sweep repro from Sprint **4.3** smoke._

1. **GPS filing:** Compose a grievance with optional latitude/longitude decimals — **`POST …/grievances`** body includes nested **`location.latitude` / `.longitude`** ; detail renders **Map pin** line.
2. **Attachment register:** After uploading a test blob to MinIO (or mocking), **`POST …/grievances/{id}/attachments/register`** — detail shows **Evidence files** list.
3. **Inbox banner:** Trigger at least one breach notification (reuse Sprint **4.3** SLA sweep smoke or insert `notifications` fixture row) — grievance list briefly shows amber **Service alerts** strip when unread **`sla_breach`** notices exist (`GET /citizen/notifications`).
4. **Public KPI:** `curl http://localhost:3001/api/public/grievances/aggregate-metrics?window_days=30` — JSON has **`totals_by_status`** / **`totals_by_category`** with **no** free-text grievance narratives.

### Manual smoke — Sprint 4.16 (hub scale: mandatory pins + shortcuts)

1. **API / DB:** Apply migration `20260515103000_citizen_pin_preferences` (`pnpm --filter @enagar/api exec prisma migrate deploy` in your environment). Restart API.
2. **Onboarding gate:** New or reset profile: after OTP verify, you must land on **Pin your municipalities** until you select ≥1 ULB and tap **Continue**. Advancing should call **`PATCH /citizen/preferences`** with `pinned_tenant_codes` (array length 1–15). You must not reach the hub KPI strip with zero pins unless DB is missing migration (API would return empty pins).
3. **Preferences API:** With a bearer token, call **`GET /citizen/preferences`** and confirm `pinned_tenant_codes` / `pinned_services` mirror the UI. **`PATCH`** with `WBPORTAL` in pins or an invalid `tenant_code` returns **400**; **>15** pins returns **400** (DTO). **>1 duplicate** codes (case-insensitive) **400** from service.
4. **Hub home:** Pinned row reflects server order; **Browse all municipalities** opens searchable modal (code / name / district from `GET /tenants`); choosing a row opens **workspace** without adding a pin (`select-tenant` unchanged; no auto-sync to pins).
5. **KPIs:** **Services** uses **`distinct_active_service_codes`** from **`GET /citizen/dashboard`** (whole-catalogue union). Apps / Pay / Griev still sum dashboard buckets. Aggregate hub fetches still **omit** `X-Enagar-Tenant-Code`.
6. **Hub Services tab:** Sections load only for **pinned** ULBs; use **Browse municipalities** for any other ULB. From a service card, opening **filtered Services** lands on workspace **Services** with only those `service_code`(s) visible; **Show all services** clears filter.
7. **Pinned service chips (home):** After saving shortcuts, chip opens correct ULB + filtered Services tab (Apply not prefilled).
8. **Shortcuts tab:** Edit pins (cap 15), add/remove service pairs, **Save shortcuts** → **`PATCH /citizen/preferences`** with both arrays; **Refresh hub** repopulates lazy `GET /services/tenants/{code}` only for pinned + shortcut ULBs.
9. **Regression:** **Back to hub** clears workspace scope and service filter; dossier / grievance / payment behaviours from Sprint 4.15 remain intact.

### Manual smoke — Sprint 4.15 (hub KPI + aggregate tabs)

1. Choose **বাংলা** before OTP; after login the **hub** Language KPI reads **BN** (onboarding locale + `PATCH /citizen/language`). Confirm service KPI + apps/payments/grievance totals (**dashboard buckets**); per‑ULB ward counts stay on **Home** municipality cards only.
2. **Network:** observe **`PATCH /citizen/language`** after verify-OTP (e.g. `language_pref: bn`). Tabbed hub **`GET /applications`** / **`GET /payments`** must **omit** `x-enagar-tenant-code`.
3. Open hub **Services** tab — grouping per ULB renders; primary CTA pushes into workspace picker.
4. Hub **Apply** repeats municipality picker and enters workspace similarly to **Home** cards.
5. Hub **My Applications** → choose a ULB‑tagged row; dossier/detail calls should carry **`tenant_code`** in headers (inspector). Initiate/settle stub flows still work (**stub complete header** derives from dossier or payment **`tenant_id`**).
6. **Back to hub** resets both workspace + hub dossier clears; KPI/tabs refill after **Refresh hub**.

### Manual smoke — Sprint 4.1 (hub data + workspace scope parity)

1. Run API (`@enagar/api`) and PWA; set `NEXT_PUBLIC_API_BASE_URL` if needed.
2. Complete OTP login (dev OTP code). Confirm you land on the **hub** KPI + tab chrome.
3. In browser devtools **Network**, select a hub bootstrap request to **`/citizen/dashboard`**: headers must **not** include `x-enagar-tenant-code`.
4. Open a municipality (e.g. KMC). Confirm subsequent **`/applications`**, **`/payments`**, **`/grievances`**, draft create, etc. **do** include `x-enagar-tenant-code: KMC` (or chosen code).
5. Use **← Back to hub**: theme returns to default; hub cards refresh (or tap **Refresh hub**); opening another ULB shows only that ULB’s scoped lists.
6. (Optional) File in two ULBs and confirm hub cards show distinct non‑zero counts per row.

## Run locally

```bash
pnpm --filter @enagar/citizen-pwa dev    # http://localhost:3000
pnpm --filter @enagar/citizen-pwa build
pnpm --filter @enagar/citizen-pwa test   # Sprint 4.2+ lib unit tests (grievance scope)
```

Set `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001/api`) to point at `@enagar/api`.

## What's coming (per [`ROADMAP.md`](../ROADMAP.md) — [Citizen Unified Hub programme](../ROADMAP.md#citizen-unified-hub-programme-option-a))

| Programme / sprint | Adds                                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hub H5.1**       | Keycloak Option A — realm, client, protocol mappers (portal `tenant_*` + stable `sub`), API verifier envs, staging smoke                                                                                                                |
| **Hub H6.1**       | [Citizen hub ops runbook](../../docs/runbooks/citizen-unified-hub.md); [PO exit checklist](../../docs/runbooks/hub-h6-exit-checklist.md) — observability + docs triage                                                                  |
| **Master Phase 5** | Sprint **5.1–5.4** — native shell + parity polish (**not** Hub **H5.x**)                                                                                                                                                                |
| Exit records       | **[`phase4-backlog-slice-exit.md`](../../docs/runbooks/phase4-backlog-slice-exit.md)** (queue **#3**, **2026-05-14**) · **[`master-sprint-54-exit.md`](../../docs/runbooks/master-sprint-54-exit.md)** (**Sprint 5.4**, **2026-05-15**) |

Smoke sections below still refer to historical labels (**Sprint 4.1**, **4.15**, **4.16**, **4.2**); map them to **Hub H4.1**, **H4.15**, **H4.16**, **H4.2** in `ROADMAP.md`.
