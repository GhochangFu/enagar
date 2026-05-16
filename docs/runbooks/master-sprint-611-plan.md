# Master Sprint 6.11 Plan — Phase 6 P4 Reporting, Content, Branding, RAG Hooks, and Bookings

Status: **executed — closed engineering**.

## Scope

Deliver the five **P4** rows from `docs/backlog/phase-6-vision-backlog-prioritized.md` as one Phase 6 continuation sprint, only within bounded MVP contracts:

- Reports PDF over the already-proven tenant reporting/CSV query contracts.
- Richer Knowledge Base authoring without weakening markdown/XSS safeguards.
- KB publish to RAG index trigger/reconcile hooks, aligned with Phase 7 indexer boundaries.
- Branding asset upload pipeline for logos/heroes with object-storage safety and contrast checks.
- Bookable assets manager/calendar MVP for tenant-owned civic assets.

P4 is materially larger than P1–P3 because it includes a Phase 7-adjacent RAG hook and a new bookings bounded context. Keep the sprint shippable by treating each item as an MVP over existing primitives, not a full product expansion.

## Key Existing Surfaces

- Tenant CSV reports already exist in `apps/api/src/modules/admin-tenant/admin-tenant.controller.ts` and `admin-tenant.service.ts`.
- Tenant Dashboard CSV downloads live in `apps/admin-tenant/app/dashboard/dashboard-client.tsx`.
- KB articles already persist as tenant-scoped `kb_articles` with localized title/body JSON, tags, status, and publish timestamp.
- KB/branding settings are currently edited through `apps/admin-tenant/app/dashboard/operations/operations-client.tsx`.
- Branding currently accepts `theme_color`, `logo_url`, and `hero_image_url` strings through tenant settings validation.
- Object storage is part of the platform and grievance attachments already use a register-after-upload metadata pattern.
- `services/rag-indexer` is a FastAPI health stub; Phase 7 owns embeddings, Qdrant quality, and retrieval behaviour.
- `packages/workflow` has a `booking` workflow pattern and the catalogue seed includes Community Hall Booking, but there is no booking reservation model/UI yet.

## Sub-Sprints

### 6.11A — Tenant PDF Reports V2

Deliverables:

- Add tenant-scoped PDF report endpoints for the same report families as Sprint 6.9 CSV:
  - SLA summary.
  - revenue/payment summary.
  - applications summary.
  - grievances summary.
- Use the existing CSV/report query boundaries as the source of truth.
- Add date-range filters where the CSV endpoints already support them.
- Add Tenant Admin download buttons beside CSV exports.
- Prefer server-rendered HTML-to-PDF with a deterministic template. Add a rendering dependency only if needed and document it in the exit runbook.
- Include report metadata: tenant code/name, generated timestamp, filters, page/report title.

Non-goals:

- No scheduled report emails.
- No chart-heavy BI dashboard.
- No per-citizen/application PII dump in PDFs.
- No custom PDF designer.

### 6.11B — Knowledge Base Rich Authoring

Deliverables:

- Replace raw JSON-first KB editing with guided authoring for:
  - slug.
  - status.
  - tags.
  - localized title/body.
  - preview per locale.
- Add a markdown toolbar/preview while preserving raw JSON fallback.
- Add safe `.docx` import if a lightweight parser can be introduced cleanly; otherwise plan and document a markdown-paste fallback.
- Add media reference support using previously uploaded/registered safe asset URLs, not arbitrary HTML.
- Keep backend validation as the source of truth: no raw scripts, no unsafe embeds, and `en` remains required.

Non-goals:

- No freeform HTML CMS.
- No untrusted iframe/embed support.
- No provider notification sends from KB publish.
- No Phase 7 answer-quality tuning.

### 6.11C — KB Publish To RAG Index Trigger

Deliverables:

- Add an idempotent KB index job/trigger contract when a KB article moves to `published`.
- Add an admin action to requeue/reconcile KB articles for the tenant.
- Add an API-to-indexer integration boundary that can work against the current `rag-indexer` stub and later Phase 7 implementation.
- Track index status per article or per tenant in a minimal, tenant-scoped way.
- Add retry-safe semantics: duplicate publish/requeue should not create unbounded duplicate work.

Non-goals:

- No embedding model implementation in this sprint.
- No Qdrant schema tuning or retrieval ranking.
- No chatbot answer generation changes.
- No indexing of citizen/application/grievance PII.

### 6.11D — Branding Asset Pipeline

Deliverables:

- Add safe tenant-admin asset upload/registration flow for logo and hero image assets.
- Reuse the object-storage metadata pattern: upload intent/register or register-after-upload, tenant-scoped.
- Validate asset metadata:
  - MIME type allowlist.
  - size limits.
  - image dimensions where practical.
  - tenant ownership.
- Add Tenant Admin UI for choosing uploaded logo/hero assets and previewing them with the current theme.
- Add contrast checks for theme presets/background combinations and block or warn on unsafe combinations.
- Persist final `logo_url` / `hero_image_url` through existing branding settings.

Non-goals:

- No public CDN provisioning.
- No image transformation service.
- No arbitrary file manager.
- No cross-tenant asset sharing.

### 6.11E — Bookable Assets Manager And Calendar MVP

Deliverables:

- Add minimal tenant-scoped models/APIs for:
  - bookable assets (code, localized name, location, capacity, active flag).
  - availability rules/blackouts.
  - reservation holds/bookings tied to an application or docket where possible.
- Add conflict-safe reservation checks to prevent overlapping bookings for the same asset/time window.
- Add Tenant Admin UI to manage assets and view a simple calendar/list of holds/bookings.
- Connect bookable assets to services that use the existing `booking` workflow pattern, without breaking non-booking services.
- Add citizen-facing availability discovery only if it can reuse existing service/apply flows without major runtime redesign.

Non-goals:

- No full calendar product.
- No recurring-event engine beyond simple availability/blackout rules.
- No PSP/payment settlement redesign.
- No staff resource rostering.
- No cross-tenant booking marketplace.

### 6.11F — Docs, Tests, Verification

Deliverables:

- Add `docs/runbooks/master-sprint-611-exit.md` during execution.
- Update P4 rows in `docs/backlog/phase-6-vision-backlog-prioritized.md` from “planned” to “closed engineering” only after implementation and verification.
- Update `README.md`, `ROADMAP.md`, `apps/admin-tenant/README.md`, `apps/citizen-pwa/README.md`, `docs/help/start-the-app-step-by-step.md`, and `tests/security/README.md`.
- Add `tests/security/master-sprint-611.spec.ts` covering:
  - PDF reports are tenant-scoped, aggregate/explicit-field only, and do not expose PII-only exports.
  - KB rich authoring preserves backend markdown/XSS validation.
  - KB index triggers are idempotent and tenant-scoped.
  - Branding assets are type/size/tenant constrained.
  - Booking reservations reject overlaps and do not cross tenant boundaries.
- Add focused API/UI tests where existing service specs make this practical.

## Exit Criteria

- Tenant Admin can download PDF reports that match existing CSV report scopes and filters.
- Tenant Admin can author KB articles through guided controls with preview and safe fallback.
- Publishing or requeueing KB articles creates a bounded, tenant-scoped RAG index trigger/reconcile record.
- Tenant Admin can upload/register/select branding assets and see contrast warnings or blocks.
- Tenant Admin can create bookable assets, add availability/blackouts, and view bookings/holds.
- Booking conflict checks prevent overlapping reservations for the same asset and tenant.
- Citizen runtime remains stable for existing service apply flows; booking discovery is additive only if implemented.
- Existing Sprint 6.8–6.10 reporting, operations, catalogue, workflow, analytics, and transparency contracts remain valid.

## Verification Plan

Run, at minimum, after implementation:

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test -- admin-tenant.service.spec.ts
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa lint
pnpm test:security -- --runTestsByPath tests/security/master-sprint-611.spec.ts tests/security/master-sprint-69.spec.ts tests/security/master-sprint-610.spec.ts
pnpm test:security
graphify update .
```

Add package-specific checks if a PDF renderer, `.docx` parser, or storage client changes package boundaries.

## Manual Smoke After Completion

1. Start infra, migrate, seed, API, Tenant Admin, Citizen PWA, and any required storage/indexer stub.
2. Sign into Tenant Admin as a KMC/HMC municipality admin.
3. Download PDF reports for SLA and payments with a date range; confirm tenant header and no unexpected PII.
4. Create/edit a KB article through guided authoring, preview each locale, publish, reload, and confirm persistence.
5. Requeue the KB article for indexing; confirm index status/trigger appears and duplicate clicks are bounded.
6. Upload/register/select a logo or hero image; confirm MIME/size rules and contrast warnings.
7. Create a bookable asset, add an availability window and blackout, then attempt overlapping and non-overlapping bookings.
8. Open Citizen PWA and confirm existing services/applications still work; if booking discovery shipped, confirm availability is visible only for booking services.
9. Re-run Sprint 6.9 CSV exports and Sprint 6.10 transparency endpoints to confirm no regressions.

## Decision Defaults

- Sprint name: `Master Sprint 6.11 — Phase 6 P4 Reporting, Content, Branding, RAG Hooks, and Bookings`.
- Keep all five P4 rows together only if implementation stays bounded to MVP contracts; split bookings into a follow-up sprint if schema/UI scope grows.
- Prefer reusing CSV report queries over creating a separate reporting warehouse.
- Prefer markdown-safe rich editing over raw HTML.
- Prefer index trigger/reconcile contracts over implementing Phase 7 embedding/retrieval quality.
- Prefer object metadata registration and tenant ownership checks over direct public file-manager semantics.
- Do not add new npm/Python dependencies unless the implementation review proves built-in or existing tools are insufficient.
