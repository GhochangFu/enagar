# EN-26 Phase 4 — Async infrastructure (EN-43, EN-44, EN-45)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist form-import jobs in Postgres, store source files in object storage, and process extraction asynchronously via BullMQ worker.

**Architecture:** API creates `form_import_jobs` row + `putObject`, enqueues `{ jobId }` on `form-import` queue when Redis and MinIO are enabled; `services/form-import-worker` fetches bytes, runs shared extractor orchestration, updates job status. Dev/CI without durable storage uses inline processing in API.

**Tech stack:** Prisma, MinIO/S3, BullMQ, NestJS, `pg` worker.

---

### Task 1: EN-45 Prisma `form_import_jobs`

- Migration `20260621120000_en26_form_import_jobs`
- `FormImportJob` model with scope, tenant/service refs, status, JSON proposal fields

### Task 2: EN-43 Object storage keys

- `form-import-storage.ts` — tenant/state key builders
- `FormImportService` calls `putObject` on create

### Task 3: EN-44 Worker + queue

- `apps/api/src/common/form-import/` — queue service + config
- `services/form-import-worker` — BullMQ consumer

### Task 4: Service refactor + UI poll

- Replace in-memory `Map` with Prisma
- `FormImportPanel` polls GET while pending/processing

### Task 5: Tests + docs + PR

- Update `form-import.service.spec.ts`, runbook
- Feature branch PR
