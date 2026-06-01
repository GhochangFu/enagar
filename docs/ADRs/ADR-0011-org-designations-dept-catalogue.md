# ADR-0011 — Organisation structure: departments, tenant categories, and designation-based workflows

| Field               | Value                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**          | Accepted                                                                                                                                                          |
| **Date**            | 2026-05-29                                                                                                                                                        |
| **Decision-makers** | Project Technical Lead                                                                                                                                            |
| **Supersedes**      | _none_ (extends ADR-0004; does not replace the workflow engine)                                                                                                   |
| **Superseded by**   | _none_                                                                                                                                                            |
| **Related**         | ADR-0004 (workflow engine), ADR-0009 (Keycloak), ADR-0010 (external data), ADR-0012 (post-approval), `docs/workflow-designations.md`, `docs/service-catalogue.md` |

## Context

Municipal services are delivered by **multiple departments** within each ULB (e.g. Advertising & Hoarding, Health, Water). Approval chains follow **organisational posts** (Hoarding Clerk → Inspector → Officer → Executive Officer), not the coarse platform roles `tenant_clerk` and `tenant_admin` alone.

Change-request proposals require:

1. **Department-scoped service categories** — each tenant defines categories under a department (not only the 14 state-wide navigation groups).
2. **Designation-based workflows** — stages and transitions name a **designation code** (ULB-defined); staff may hold **multiple** designations; the Desk queue shows the **union** of work pending at any of them.
3. **Citizen catalogue UX unchanged in shape** — citizens still browse the **14 global categories**; an optional **department filter** narrows the service list.
4. **Board of Councillors (BOC)** — when policy requires it, a BOC resolution must be recorded **in-system** before finalization; when not required, that stage is skipped via **transition guards**, not a separate workflow version.
5. **No ward-based routing** for designation assignment or site-inspection queues in this programme slice.
6. **No state-wide designation library** — each ULB invents designation codes locally (contrast with the global grievance library).
7. **Backward compatibility** — existing workflows that use `tenant_clerk` / `tenant_admin` continue to work until migrated per service.

ADR-0004 already commits to a Postgres-backed, data-defined workflow engine. This ADR defines the **organisational and actor model** that engine will use going forward, without adopting a new BPM product.

## Decision

**eNagarSeba will model ULB organisation as tenant-scoped departments and designations, bind services to department-owned tenant categories, and drive application workflows primarily by designation codes—with legacy role-based workflows supported until each service is migrated.**

Concretely:

1. **Departments** — table `tenant_departments` (`tenant_id`, `code`, multilingual `name`, `is_active`). Example: Advertising & Hoarding.
2. **Designations** — table `tenant_designations` with `scope` ∈ `{ department, municipality }`, optional `department_id` when scope is department. Codes are **unique per tenant** and chosen by the ULB (no State master list).
3. **Staff assignment** — table `user_designations` linking `users` to many designations; **no ward scoping** on designation rows for this feature.
4. **Tenant service categories (Option A)** — table `tenant_service_categories` scoped to `(tenant_id, department_id)`. `tenant_services.category_id` references this table. Each service also stores `global_category_code` (one of the 14 codes, e.g. `adv`) for citizen navigation and filtering.
5. **Workflow actors** — extend workflow stages/transitions with `owner_designation` / `actor_designation` (alongside legacy `owner_role` / `actor_role` during migration). Runtime field `applications.pending_designation` parallels `pending_role`.
6. **Permission matrix** — `designation_stage_map` (successor to `role_stage_map`) with `can_view` / `can_act` per stage.
7. **Desk queue** — “my queue” = applications where `pending_designation` is in the caller’s designation set **OR** (legacy) `pending_role` matches JWT coarse roles.
8. **Keycloak** — remains the source of **portal access** (`tenant_clerk`, `tenant_admin`, MFA). **Workflow authority** for migrated services is resolved from Postgres designations by `sub` + `tenant_id`, not from hundreds of realm roles per designation.
9. **BOC** — workflows may include a `boc-resolution` (or equivalent) stage owned by a municipality-scoped designation. Reachability is controlled by **guards** on transitions and `runtime_snapshot.requires_boc_resolution`, set per service policy (`never` | `always` | `officer_may_require`). The stage stays in the published graph; guards skip it when not required. BOC sign-off requires resolution metadata and optionally an uploaded resolution document.
10. **Citizen catalogue** — list services by global category; optional query `department_id` filters within that category. No department-first home navigation.

Implementation detail, schema sketches, and migration rules live in [`docs/workflow-designations.md`](../workflow-designations.md).

## Alternatives considered

| Option                                                     | Pros                               | Cons                                                               | Rejected because                                                         |
| ---------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Keep role-only workflows; map clerk/admin in UI**        | No schema change                   | Cannot express real ULB chains; one clerk role for all departments | Fails the business model for hoarding and similar services               |
| **Keycloak realm role per designation**                    | JWT-only authz                     | Hundreds of roles per ULB; realm export churn; composite role pain | Operational and security review cost; ADR-0009 single-realm model breaks |
| **State global designation library (like grievances)**     | Consistent codes across ULBs       | ULB post titles differ; forces central maintenance                 | Sponsor decision: each ULB invents codes freely                          |
| **Option B: global category + department on service only** | Smaller schema                     | Categories not dept-owned; weaker admin mental model               | Sponsor chose Option A                                                   |
| **Department-first citizen navigation**                    | Clear org mirror                   | Breaks existing 14-category UX and prototypes                      | Sponsor chose global category + department filter                        |
| **Separate workflow version with/without BOC stage**       | Simple graphs per variant          | Version proliferation; in-flight snapshot confusion                | Single graph + guards is simpler (accepted recommendation)               |
| **Ward-scoped inspector routing**                          | Matches field reality in some ULBs | Explicitly out of scope for this programme                         | Deferred; not required now                                               |
| **Replace ADR-0004 engine with Camunda/Temporal**          | BPMN modeller                      | Cost, ops, tenant configurability                                  | Already rejected in ADR-0004                                             |

## Consequences

### Positive

- Workflows match how ULBs actually approve (post title / designation), including municipality-level Executive Officer and conditional BOC.
- Department-owned categories align service ownership with municipal structure.
- ADR-0004 engine, timeline audit, and BullMQ side effects remain valid; this is an actor-model evolution.
- Legacy services keep working during gradual migration.
- Citizen apps keep familiar category browsing with an additive filter.

### Negative / costs

- **Schema and API surface growth** — org master, catalogue reshape, dual-read workflow columns, designer UI updates.
- **Authz two-layer mental model** — Keycloak coarse role for login + Postgres designations for transitions until fully migrated.
- **Migration discipline** — each service must publish a designation workflow and staff assignments before decommissioning role-based stages.
- **Testing matrix** — multi-designation users, BOC guard branches, legacy compat, tenant isolation on new tables.

### Neutral / follow-ups required

- **Phase implementation** (see `docs/workflow-designations.md` §10): org master → tenant categories → forward/return/reject → municipal ladder → BOC → post-approval (ADR-0012).
- **PWD / works template:** maker–checker–dept head → EO/CIC/VC/Chairperson (high-value guard) → return chain → dept head payment link → work order — spec §7.1.
- **Prisma migration** — additive columns first; backfill optional; do not drop `owner_role` until migration complete.
- **`@enagar/workflow`** — extend types and `evaluateTransition` for designation + legacy role.
- **Grievances** — remain role-routed for now; may later align to designations in a separate ADR.
- **Glossary** — terms Department, Designation, Tenant Service Category, BOC policy (updated in same programme).
- **ADR-0004** — cross-reference only; runtime engine unchanged.

## Compliance / verification

- **RLS** — `tenant_departments`, `tenant_designations`, `user_designations`, `tenant_service_categories`, `designation_stage_map` must have the same tenant-isolation policies as `workflows` / `applications` (see `tests/security/tenant-isolation.spec.ts`).
- **Evaluator tests** — designation allowed / denied; legacy role fallback; BOC guard blocks transition without `requires_boc_resolution`; BOC transition requires resolution fields when configured.
- **Desk integration tests** — user with two designations sees union queue; legacy app still filters on `pending_role`.
- **Citizen catalogue tests** — `category=adv` + `department_id` returns only hoarding-dept services.
- **No ward routing** — tests must not assert ward-based designation filtering for this ADR scope.

## References

- [`docs/workflow-designations.md`](../workflow-designations.md) — specification and migration plan.
- [`docs/ADRs/ADR-0004-workflow-engine.md`](./ADR-0004-workflow-engine.md).
- [`docs/ADRs/ADR-0009-identity-keycloak.md`](./ADR-0009-identity-keycloak.md).
- [`docs/glossary.md`](../glossary.md) — §1, §4, §5 updates.
- [`docs/service-catalogue.md`](../service-catalogue.md) — 14 global categories.
- [`packages/workflow/src/index.ts`](../../packages/workflow/src/index.ts) — evaluator.
- [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) — current workflow tables (pre-migration).
