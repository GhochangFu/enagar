# Unified Portal Option A — CORS & MinIO (Phase 5)

**Companion to:** [unified-portal-option-a-plan.md](./unified-portal-option-a-plan.md) § Phase 5  
**Env matrix:** [unified-portal-env-matrix.md](./unified-portal-env-matrix.md)  
**Shared origins:** [`infrastructure/unified-portal/cors-origins.mjs`](../../infrastructure/unified-portal/cors-origins.mjs)

Phase 5 aligns **API CORS** and **MinIO browser CORS** with the three HTTPS portal subdomains while keeping localhost for daily dev.

---

## 1. Two CORS layers

| Layer        | Env var                       | Who reads it                           | Purpose                                            |
| ------------ | ----------------------------- | -------------------------------------- | -------------------------------------------------- |
| **Nest API** | `CORS_ORIGIN`                 | `apps/api/src/main.ts`                 | Browser `fetch` to `enagarapi.demosites.co.in/api` |
| **MinIO**    | `MINIO_API_CORS_ALLOW_ORIGIN` | `docker-compose.yml` → MinIO container | Browser `PUT` to presigned upload URLs             |

Both must list the **citizen**, **tenant**, and **state** HTTPS origins on the demo VM.

---

## 2. Demo VM values

From [`demo-hosts.json`](../../infrastructure/unified-portal/demo-hosts.json) — copy via [`infrastructure/.env.production.example`](../../infrastructure/.env.production.example):

```env
CORS_ORIGIN=https://enagarcitizen.demosites.co.in,https://enagartenant.demosites.co.in,https://enagarstate.demosites.co.in

MINIO_API_CORS_ALLOW_ORIGIN=https://enagarcitizen.demosites.co.in,https://enagartenant.demosites.co.in,https://enagarstate.demosites.co.in

ALLOW_CLIENT_SCAN_SIMULATION=true
```

**Apply MinIO CORS:**

1. Set vars in `infrastructure/.env` on the VM.
2. Copy [`docker-compose.unified-portal-demo.override.example.yml`](../../infrastructure/docker-compose.unified-portal-demo.override.example.yml) → `docker-compose.override.yml` (or merge MinIO block).
3. Recreate MinIO: `docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env up -d minio`
4. Run `pnpm infra:minio-cors` (creates bucket + bucket-level CORS when supported).

Restart the **API** after changing `CORS_ORIGIN`.

---

## 3. Local dev (unchanged)

| Setting                       | Value                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `CORS_ORIGIN`                 | `http://localhost:3000,3002,3003,8081` (in `.env.example`)                        |
| `MINIO_API_CORS_ALLOW_ORIGIN` | same localhost list                                                               |
| `pnpm infra:minio-cors`       | uses `MINIO_API_CORS_ALLOW_ORIGIN` or defaults to localhost + demo citizen origin |

---

## 4. Document upload & scan policy (demo VM)

### Recommended for external HTTPS demo (pilot)

Presigned URLs today point at `127.0.0.1:9000` — a visitor’s browser cannot reach the VM’s localhost. Until a storage proxy is added:

```env
OBJECT_STORAGE_DISABLED=true
ALLOW_CLIENT_SCAN_SIMULATION=true
NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION=true   # citizen build
```

Flow: stub `minio://` upload URLs → skip browser PUT → `confirm-upload` → client `scan-result` simulation → apply submit works without MinIO browser PUT.

### Full MinIO path (when storage proxy exists)

```env
OBJECT_STORAGE_DISABLED=false
ALLOW_CLIENT_SCAN_SIMULATION=false
```

Run `pnpm --filter @enagar/document-scan-worker dev` (or queue worker on VM). MinIO CORS must include the citizen HTTPS origin.

---

## 5. Manual smoke (VM — after cutover)

| ID    | Check                                                                            | Pass |
| ----- | -------------------------------------------------------------------------------- | ---- |
| C5-01 | Citizen: DevTools Network — API calls to `enagarapi` — no CORS errors            |      |
| C5-02 | Tenant Desk: list loads — no CORS errors                                         |      |
| C5-03 | Citizen apply + file upload (simulation profile) — submit succeeds               |      |
| C5-04 | Optional: real MinIO PUT — only after presigned URLs use a public-reachable host |      |

---

## 6. CI contract

[`tests/security/unified-portal-cors.spec.ts`](../../tests/security/unified-portal-cors.spec.ts)

---

## Related

- [unified-portal-keycloak-phase4.md](./unified-portal-keycloak-phase4.md)
- [object-storage-upload-programme.md](./object-storage-upload-programme.md)
- [start-the-app-step-by-step.md](../help/start-the-app-step-by-step.md) — local MinIO + `pnpm infra:minio-cors`
