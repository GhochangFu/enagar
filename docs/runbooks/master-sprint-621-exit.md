# Master Sprint 6.21 Exit — Grievance Taxonomy Foundation

**Status:** **closed — engineering** (2026-05-19)  
**Plan:** [`master-sprint-621-plan.md`](./master-sprint-621-plan.md) · **Programme:** [`grievance-taxonomy-programme.md`](./grievance-taxonomy-programme.md)

## Engineering checklist

| ID  | Criterion                                                         | Pass | Evidence                                                                                         |
| --- | ----------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| E1  | Migration applies on CI Postgres                                  | ✅   | `20260519120000_grievance_taxonomy` applied; `pnpm db:migrate` + `pnpm db:seed` green            |
| E2  | `GET /public/grievances/catalogue?tenant_code=KMC` ≥10 categories | ✅   | **10** categories (roads … other); sub-types on streetlights, drainage, stray_dogs, parks, trade |
| E3  | Invalid category on create → 400                                  | ✅   | Live: `POST /api/grievances` + `not-a-real-category` → **400**                                   |
| E4  | Valid seeded category create → 201                                | ✅   | Live: `roads` → `GRV-KMC-2026-000007`                                                            |
| E5  | Legacy grievance list/detail regression                           | ✅   | Live: list returns row; `GET …/grievances/{grievance_no}` → `category: roads`                    |
| E6  | CI: lint, typecheck, test, `master-sprint-621.spec.ts`            | ✅   | `@enagar/api` lint; repo `pnpm typecheck`; `grievance-catalogue.spec.ts` (4); security spec (5)  |

### Additional live checks (2026-05-19)

- `GET /api/grievances/catalogue` with portal JWT + `x-enagar-tenant-code: KMC` → `tenant_code: KMC`
- Seed order fix: global taxonomy before tenant adoption (`prisma/seed.ts`)

## Sign-off

| Role               | Initials | Date       |
| ------------------ | -------- | ---------- |
| Engineering        | AI agent | 2026-05-19 |
| Sponsor (optional) |          |            |

## Next

**Sprint 6.22** — Tenant Admin grievance catalogue + SLA/routing configurators ([`master-sprint-622-plan.md`](./master-sprint-622-plan.md)).
