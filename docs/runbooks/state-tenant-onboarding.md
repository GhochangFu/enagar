# State Admin tenant onboarding (EN-3) — Demo VM

**VM deploy (logout + EN-3):** [vm-deploy-demo-current-stage.md](./vm-deploy-demo-current-stage.md)

## Wizard flow

Use for **New municipality** (blank draft) or **Re-onboard** (click an existing ULB in the list — loads `GET /api/admin/state/tenants/{code}/onboarding-context`).

1. **Profile** — ULB code, name, district, wards, theme, languages (code is read-only on re-onboard).
2. **Catalogues** — adopt **published** global services by service category; optional grievance categories (pre-selected from current DB where possible).
3. **Tenant admin** — Keycloak `tenant_admin` (`{code}-tenant-admin`) and temporary password.
4. **Review** — **Activate municipality** (new) or **Apply onboarding** (existing).

## On activate (automatic)

- Adopts **published** global services for the service categories selected in step 2 (wizard sends `service_category_codes`; omitting them falls back to `inherit_default_services`).
- Publishes tenant form **v1** per adopted service: uses the global `form_schema` when it passes `@enagar/forms` validation; otherwise a **blank draft** from `createBlankFormSchemaDraft()` (valid minimal apply form — not the old invalid stub).
- Records audit metadata: `forms_from_global`, `forms_stubbed` (EN-4).
- Adopts grievance categories when selected (`grievance_category_codes`).
- Provisions Keycloak `tenant_admin` (`{code}-tenant-admin`) with `tenant_id` / `tenant_code` attributes and the wizard password.
- **Org pack (Phase 14):** upserts **24 departments** (Appendix A) and **47 sample designations** (Appendix B + municipal ladder + hoarding pilot roles). Optional override: `TENANT_ORG_IMPORT_PATH` → JSON import file (see `infrastructure/onboarding/README.md`).
- Triggers RAG indexer `POST /index/tenant/{code}` when `RAG_INDEXER_URL` is set.
- `GET /api/tenants` lists active ULBs from Postgres (citizen picker).

## Wizard payload (State Admin → API)

**Activate municipality** / **Apply onboarding** must POST the full upsert body. The State UI builds it via `tenantDraftToPayload()` and includes:

| Field                                                  | Purpose                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `service_category_codes`                               | Which global service categories to adopt |
| `grievance_category_codes`                             | Optional grievance catalogue adoption    |
| `tenant_admin_username`                                | Defaults to `{code-lower}-tenant-admin`  |
| `tenant_admin_email` / `tenant_admin_password` / names | Keycloak provision on activate           |

If catalogues or tenant-admin fields are missing from the payload, activate succeeds but **no services are adopted** and **no tenant admin is created**.

## Known limitations (demo VM)

| Issue                            | Workaround                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Re-onboard** skips form repair | If a ULB already has a **published** invalid form from an older deploy, re-onboard does not replace it. Use a **new ULB code** for a clean wizard test, or fix forms in Tenant Admin / DB.                                |
| **Grievance codes**              | Adopt API requires **kebab-case** codes. Some seeded globals use underscores (e.g. `street_lighting`) and fail adopt until seed is aligned — select only kebab-case rows in the wizard, or skip grievances for the pilot. |
| **~6 services**                  | Only **published** global services in selected categories appear (expected).                                                                                                                                              |
| **Minimal apply forms**          | Empty global `form_schema` → blank draft v1 (citizen can apply; rich templates are EN-4 seed + State library).                                                                                                            |

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
