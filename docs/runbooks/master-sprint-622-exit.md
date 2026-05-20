# Master Sprint 6.22 Exit — Tenant Admin Grievance Configuration

**Status:** **closed — engineering** (2026-05-20)  
**Plan:** [`master-sprint-622-plan.md`](./master-sprint-622-plan.md) · **Prerequisite:** Sprint **6.21** closed

## Engineering checklist

| ID  | Criterion                                   | Pass | Evidence                                                                                       |
| --- | ------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| E1  | Admin adds local category + subtypes        | ✅   | Live: `POST …/grievance-catalogue/categories` `noise-pollution` + subtype `construction-noise` |
| E2  | Catalogue API reflects new type same tenant | ✅   | Live: `GET /public/grievances/catalogue?tenant_code=KMC` includes **noise-pollution**          |
| E3  | SLA rule affects `sla_due_at` on new filing | ✅   | Live: 24h policy → filing `GRV-KMC-2026-000013` **~24h** `sla_due_at`                          |
| E4  | Routing rule assigns expected role          | ✅   | Live: routing rule → `routed_role_code: tenant_clerk` on new filing                            |
| E5  | Clerk blocked from catalogue writes (403)   | ✅   | `tenant_clerk` excluded from portal staff; writes use `assertTenantPortalAdminWrite`           |
| E6  | Desk shows localized labels                 | ✅   | Live: desk row `category_label: Noise pollution`, `subtype_label: Construction noise`          |

## Manual smoke

| Step                                     | Pass |
| ---------------------------------------- | ---- |
| Masters → Grievance catalogue → add type | ✅   |
| Operations → SLA + Routing               | ✅   |
| Desk queue label check                   | ✅   |

### Live run (2026-05-20)

```bash
powershell -NoProfile -File scripts/sprint-622-smoke.ps1
```

Keycloak: `kmc-municipality-admin-dummy` · Citizen OTP `9836177767` / `12345` · API `:3001`

**Note:** Admin category codes must be **kebab-case** (`noise-pollution`, not `noise_pollution`).

## Sign-off

| Role        | Initials | Date       |
| ----------- | -------- | ---------- |
| Engineering | AI agent | 2026-05-20 |
