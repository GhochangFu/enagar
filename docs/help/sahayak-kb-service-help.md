# Sahayak KB — per-service help articles

Phase 7 **Sahayak AI** grounds answers in tenant **Knowledge Base (KB)** articles stored in Postgres (`kb_articles`). This document describes the **seeded citizen help corpus** for every municipality and every catalogue service currently in the platform.

## What gets seeded

| Item               | Slug pattern                   | Count (reference data)                             |
| ------------------ | ------------------------------ | -------------------------------------------------- |
| Municipality index | `help-services`                | 8 ULBs                                             |
| Grievance guide    | `help-grievances`              | 8 ULBs                                             |
| Per-service guide  | `help-services-<service-code>` | 6 global services + KMC-only `pet-licence` per ULB |

Slugs use hyphens only (Postgres `kb_articles_slug_check`: `^[a-z0-9][a-z0-9-]*[a-z0-9]$`).

**Municipalities (ULBs):** KMC, HMC, CMC, BMC, SMC, AMC, DMC, SDDM (excludes citizen portal `WBPORTAL`).

**Services:** From `resolveEffectiveServices()` in `apps/api/src/modules/services/service-catalogue.seed.ts` (birth certificate, property tax, trade licence, community hall, sanitation grievance, RTI, plus KMC pet licence).

Each article includes **English, Bengali, and Hindi** markdown in `title` and `body` JSON fields, tags `sahayak` + `service-help`, and status **`published`**. Inactive tenant services (e.g. HMC community hall) remain published with an **availability** section so Sahayak can say the service is off.

## Load into the database

From repo root (Postgres + migrations applied):

```bash
pnpm db:seed
```

Implementation: `apps/api/src/modules/kb/sahayak-service-help.seed.ts` — called from `apps/api/prisma/seed.ts` after the service catalogue seed.

Published rows also get a **`kb_index_jobs`** row (`trigger: nightly_reconcile`) for the Phase 7 RAG indexer.

## Extending content

1. Add or change services in `service-catalogue.seed.ts`.
2. Adjust templates in `sahayak-service-help.seed.ts` (`buildTenantSpecificNotes`, `WORKFLOW_STEPS`, `DOCUMENT_LABELS`).
3. Re-run `pnpm db:seed` (upserts by `tenant_id` + `slug`).

Tenant admins can edit the same articles later via **Operations → KB** in Tenant Admin; Sahayak should prefer **published** articles with tag `sahayak`.

## Phase 7 note

Seeding fills **Postgres only**. Vector indexing into **Qdrant** is Sprint **7.1** (`services/rag-indexer`). Until that runs, Sahayak development can read `kb_articles` directly or via admin list APIs.

## Related

- [`ROADMAP.md`](../ROADMAP.md) — Phase 7 scope and exit criteria
- [`docs/service-catalogue.md`](../service-catalogue.md) — full 76-service prototype catalogue (future expansion)
- [`docs/glossary.md`](../glossary.md) — Sahayak, KB, citation rules
