# State Admin tenant onboarding (EN-3) — Demo VM

**VM deploy (logout + EN-3):** [vm-deploy-demo-current-stage.md](./vm-deploy-demo-current-stage.md)

## Wizard flow

Use for **New municipality** (blank draft) or **Re-onboard** (click an existing ULB in the list — loads `GET /api/admin/state/tenants/{code}/onboarding-context`).

1. **Profile** — ULB code, name, district, wards, theme, languages (code is read-only on re-onboard).
2. **Catalogues** — adopt **published** global services by service category; optional grievance categories (pre-selected from current DB where possible).
3. **Tenant admin** — Keycloak `tenant_admin` (`{code}-tenant-admin`) and temporary password.
4. **Review** — **Activate municipality** (new) or **Apply onboarding** (existing).

## On activate (automatic)

- Copies published global services (and publishes v1 forms — global schema or stub).
- Adopts grievance categories when selected.
- Provisions Keycloak `tenant_admin` with `tenant_id` / `tenant_code` attributes.
- Triggers RAG indexer `POST /index/tenant/{code}` when `RAG_INDEXER_URL` is set.
- `GET /api/tenants` lists active ULBs from Postgres (citizen picker).

## Demo VM env

```env
ENAGAR_DEMO_VM_MFA_BYPASS=true
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<secret>
RAG_INDEXER_URL=http://127.0.0.1:8100
```

## Verify

```powershell
$env:API_URL='https://enagarapi.demosites.co.in'
$env:KEYCLOAK_TOKEN_URL='https://enagarauth.demosites.co.in/realms/enagar/protocol/openid-connect/token'
$env:TENANT_CODE='BLYM'
pnpm verify:en3
```

## Pilot credentials (example)

| ULB  | Tenant admin        | Password (default dummy policy) |
| ---- | ------------------- | ------------------------------- |
| BLYM | `blym-tenant-admin` | `DummyDev_2026!ChangeMe`        |

State admin still requires **MFA (TOTP)** enrolled in Keycloak when `DEV_AUTH_ENABLED=false`.
