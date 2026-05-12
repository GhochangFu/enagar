# @enagar/citizen-pwa

Citizen-facing **Progressive Web App** built on **Next.js 14** App Router (per ADR-0003).

## Current surface

- **Onboarding (Phase 1 + 4.x hub):** splash → language → mobile OTP (**`tenant_code: WBPORTAL`** per Option A) → **Citizen hub** (**Sprint 4.15 KPI strip & tabs** atop Sprint 4.1 data): parallel **`GET /citizen/dashboard`**, **`GET /tenants`**, unscoped **`GET /applications`** + **`GET /payments`**, catalogue-wide service fetch for KPI union — aggregate calls **omit** `X-Enagar-Tenant-Code`; after OTP **`PATCH /citizen/language`** persists the onboarding locale to the citizen profile; **hub Language KPI** shows **`language`** (same as **`t(...)`**) so Bengali onboarding shows **BN**; **Home** municipality cards unchanged; optional **Applications** dossier + payment actions pass the row’s **`tenant_code`**. **`Services` / Apply** tabs funnel into picking a municipality for workspace (**`POST /citizen/select-tenant`** + scoped header thereafter).
- **Hub ↔ workspace:** **Back to hub** clears workspace selection and resets branding to defaults; dashboard cards show per‑ULB application / payment / grievance counts and theme badges.
- **Services & applications (Phase 2):** tenant catalogue, `@enagar/forms` apply flow, draft → document scan simulation → submit, **My Applications** with detail + comments (writes include scope header when in workspace).
- **Payments (Phase 3 stub rail):** initiate stub payment, simulate PSP capture, list payments, receipt metadata preview (**receipt GET** uses **ULB scope** from workspace or from the payment’s municipal tenant in hub).
- **Grievances (Phase 4 — Sprint 4.2):** **Grievances** tab — profile gate (`/citizen/register` when needed), category + priority + description, optional location notes, list/detail with SLA chips, timeline, comments, and **rating after resolved** (closes to `closed` per API).

Shared: Tailwind preset (`@enagar/config/tailwind/base`), `@enagar/i18n`, `@enagar/tenant-theme`.

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
```

Set `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001/api`) to point at `@enagar/api`.

## What's coming (per ROADMAP.md)

| Phase | Adds                                                        |
| ----- | ----------------------------------------------------------- |
| 4.3+  | Grievance escalations, reopen, attachments, pushes          |
| 5     | Native mobile parity, offline shell, installable PWA polish |
| 7     | Sahayak AI floating chat (SSE → `apps/api`)                 |
