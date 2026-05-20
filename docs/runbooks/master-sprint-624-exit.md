# Master Sprint 6.24 Exit — State Library & Programme Close

**Status:** **closed — engineering** (2026-05-20)  
**Plan:** [`master-sprint-624-plan.md`](./master-sprint-624-plan.md) · **Programme gate for Phase 7**

## Programme checklist

| ID  | Criterion                                      | Pass | Evidence                                                                                             |
| --- | ---------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| P1  | Sprints 6.21–6.23 exits signed                 | ☑    | 621–623 exits closed 2026-05-19 / 2026-05-20                                                         |
| P2  | State publish → tenant adopt → citizen visible | ☑    | `s624-state-smoke` + 3 subtypes; KMC adopt; public catalogue KMC only                                |
| P3  | Fork + deactivate behaviours verified          | ☑    | `s624-state-smoke-local` label on catalogue; deactivate hides picker; `GRV-KMC-2026-000020` retained |
| P4  | No hardcoded category enums in filing paths    | ☑    | `master-sprint-624.spec.ts`                                                                          |
| P5  | Docs updated (glossary, ARCHITECTURE, help)    | ☑    | glossary §6, help operator section; ARCHITECTURE sponsor pass deferred                               |
| P6  | CI green incl. specs 621–624                   | ☑    | `pnpm test:security -- --testPathPattern=master-sprint-62[1-4]` — **21/21** pass (2026-05-20)        |

## Manual smoke matrix

See [`master-sprint-624-plan.md`](./master-sprint-624-plan.md) § Manual smoke.

| #   | Scenario                                   | Pass     | Evidence                                                                                                                   |
| --- | ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | State creates global category + 3 subtypes | ☑        | `:3003` **Grievance library** lists `s624-state-smoke` (3 sub-types); API `POST` 201 from `kmc-state-admin-dummy` session  |
| 2   | KMC adopts; HMC does not                   | ☑        | `POST …/tenants/KMC/grievance-catalogue/adopt` → public `?tenant_code=KMC` has type, `HMC` does not                        |
| 3   | KMC forks; citizens see forked label       | ☑        | Fork `s624-state-smoke-local` → PATCH label **S624 forked label (KMC)** on public catalogue                                |
| 4   | Deactivate hides picker; Desk keeps docket | ☑        | Public catalogue no `s624-state-smoke-local` after deactivate; `GRV-KMC-2026-000020` still listed for staff                |
| 5   | Citizen PWA files new type + subtype       | ☑        | API citizen OTP `9836177767` / `12345` filed `GRV-KMC-2026-000020`; compose UX: photo/video + map pin (2026-05-20)         |
| 6   | Mobile files same                          | ☐ waived | Expo composer parity via `@enagar/grievance-catalogue` + API; device automation flaky — sponsor waived for programme exit  |
| 7   | SLA + routing per Operations               | ☑        | SLA 12h policy applied (`sla_due_at` ~12h); routing `municipality_clerk` (default queue)                                   |
| 8   | Public aggregate-metrics bucket            | ☑        | `GET …/aggregate-metrics?tenant_code=KMC` returns `metadata.legacy_unmapped`; inactive/deactivated codes roll into `other` |

**Post-close polish (same programme, not blocking):** Tenant Desk grievance detail — location map + evidence preview grid; Leaflet pin CSS fix; desk API `attachments[]` + blob preview route.

**State UI notes:** Initial load hit transient **Failed to fetch** while API recompiled; **Save category** fixed with form `onSubmit`. Municipality **Profile → Adopt** drawer not in a11y snapshot; adopt verified via state API.

## Phase gate

**Pass** — [`ROADMAP.md`](../../ROADMAP.md) updated: **6.21–6.24** closed; **Phase 7 (Sahayak AI)** is next execution item (sponsor sign-off on charter/DPA still applies per ROADMAP open items).

## Sign-off

| Role        | Initials | Date       |
| ----------- | -------- | ---------- |
| Engineering | ENG      | 2026-05-20 |
| Sponsor     |          | (optional) |
