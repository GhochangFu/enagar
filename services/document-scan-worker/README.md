# @enagar/document-scan-worker

BullMQ consumer for **application document virus scan** (Sprint 6.27).

## Run locally

Prerequisites: Postgres, Redis, MinIO (same as API), migrations applied.

```bash
# From repo root — loads infrastructure/.env if exported by your shell
set REDIS_URL=redis://:redis_dev_pw_change_me@127.0.0.1:6379
set DATABASE_URL=postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public
set OBJECT_STORAGE_DISABLED=false
set DOCUMENT_SCAN_STUB=clean

pnpm --filter @enagar/document-scan-worker dev
```

With **worker queue mode** on the API, unset `ALLOW_CLIENT_SCAN_SIMULATION` (or set `false`) so `confirm-upload` enqueues jobs here.

## Stub modes (`DOCUMENT_SCAN_STUB`)

| Value             | Behaviour                 |
| ----------------- | ------------------------- |
| `clean` (default) | Non-EICAR bytes → `clean` |
| `infected`        | Always `infected`         |
| `failed`          | Always `failed`           |

Files containing the **EICAR** test string are always marked `infected`.

## Optional ClamAV

`docker compose --profile clamav up -d` (see `infrastructure/docker-compose.yml`). Set `CLAMAV_ENABLED=true` when wiring a real `clamd` client (stub path today).
