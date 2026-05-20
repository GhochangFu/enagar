# Master Sprint 6.23 Plan — Citizen Grievance Catalogue (PWA + Mobile)

**Status:** **closed — engineering** (2026-05-20)  
**Parent:** [`grievance-taxonomy-programme.md`](./grievance-taxonomy-programme.md)  
**Prerequisite:** Sprint **6.21** closed; **6.22** recommended for operator smoke data.

## Goal

Remove **hardcoded** grievance category lists from Citizen PWA and mobile; citizens file using **tenant catalogue** from API including **sub-type** selection.

## Deliverables

### D1 — Shared client package

- Add `packages/grievance-catalogue` (or extend `@enagar/types`):
  - Types: `GrievanceCatalogueCategory`, `GrievanceCatalogueSubtype`
  - `fetchPublicGrievanceCatalogue(apiRoot, tenantCode)`
  - `fetchScopedGrievanceCatalogue(apiRoot, accessToken, tenantCode)`

### D2 — Citizen PWA

- `grievances-workspace.tsx`: remove `GRIEVANCE_CATEGORY_CODES` export used for filing.
- Load catalogue on workspace mount; cache in session for tab switches.
- Two-step composer: category grid → subtype list (skip step if zero subtypes).
- Submit `category` + `subtype_code`; keep description/location/priority/photos.

### D3 — Mobile

- Remove `apps/mobile/src/constants/grievanceCategories.ts` from composer path.
- `GrievanceComposerScreen`: same two-step UX; offline draft stores codes only.
- Hub grievance list: label resolution via cached catalogue or API field if added.

### D4 — i18n fallback chain

1. API `name[locale]`
2. Legacy `grievance.cat.{code}` keys for known seeds
3. Raw `code` as last resort

### D5 — API enhancement (if needed)

- Optional: include `category_label` / `subtype_label` on grievance list rows to avoid N+1 client fetches — only if perf requires.

### D6 — Tests & docs

- PWA component test or security spec for “no static category enum in filing path”.
- `tests/security/master-sprint-623.spec.ts`
- Update `apps/citizen-pwa/README.md`, `apps/mobile/README.md`

## Exit criteria

See [`master-sprint-623-exit.md`](./master-sprint-623-exit.md) — PWA + mobile file grievance with admin-added category (from 6.22 smoke).

## Verification

```bash
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/mobile typecheck
pnpm test:security -- --runTestsByPath tests/security/master-sprint-623.spec.ts
```

Manual matrix: KMC workspace → new category visible → file → appears in hub list and Desk.
