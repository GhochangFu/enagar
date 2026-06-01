# Workflow designations and department-scoped catalogue

> **Status:** v0.2 — accepted with [ADR-0011](./ADRs/ADR-0011-org-designations-dept-catalogue.md) and [ADR-0012](./ADRs/ADR-0012-post-approval-execution.md) (2026-05-29).  
> **Purpose:** Implementation specification for departments, tenant service categories, designation-based workflows (maker/checker/approver, municipal ladder, forward/return), BOC guards, post-approval payment/work-order/feedback, and legacy role compatibility.  
> **Engine:** Unchanged from [ADR-0004](./ADRs/ADR-0004-workflow-engine.md) — Postgres definitions, `@enagar/workflow` evaluation, NestJS transitions, BullMQ side effects.

---

## 1. Problem statement

Today, workflow stages use coarse JWT roles (`tenant_clerk`, `tenant_admin`, `citizen`). ULBs need:

- Services and categories owned by **departments**.
- Approval chains keyed to **designations** (Hoarding Clerk, Executive Officer, Board of Councillors, …).
- Staff with **multiple designations** and a Desk queue that unions pending work.
- **Conditional BOC** resolution before finalization when policy requires it.
- **Legacy workflows** until each service is migrated.

---

## 2. Goals and non-goals

### Goals

| #   | Goal                                                                                     |
| --- | ---------------------------------------------------------------------------------------- |
| G1  | Tenant-scoped departments and ULB-defined designation codes                              |
| G2  | Tenant service categories per department (Option A)                                      |
| G3  | Citizen browse: 14 global categories + optional `department_id` filter                   |
| G4  | Designation-based `owner_*` / `actor_*` / `pending_*` with legacy role fallback          |
| G5  | Desk “my queue” = union of pending designations (and legacy roles)                       |
| G6  | BOC stage in graph; guards skip when not required                                        |
| G7  | Gradual per-service migration from role-based workflows                                  |
| G8  | Maker / checker / approver stages with **forward** and **return** (internal)             |
| G9  | **Reject** only by department head and **Chairperson** (where ladder applies)            |
| G10 | Municipal ladder EO → CIC → VC → Chairperson for **high-value** services (configurable)  |
| G11 | Post-approval: dept head issues **payment link** → paid → work order → assign → feedback |
| G12 | ULB department seed (24 standard departments) + per-dept designation catalog             |

### Sponsor decisions locked (2026-05-29)

| Topic                  | Decision                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reject**             | **Department head** may reject in dept chain; **Chairperson** may reject at top of municipal ladder. Other designations: forward and return only (no reject).                           |
| **Officer actions**    | **Forward** and **return** along the chain — not a second “approve” on the same stage. Use verbs `forward` and `return` (internal). Citizen correction remains `return-for-correction`. |
| **Payment link**       | Issued by **department head only**, after municipal **return** chain completes — not Accounts/Cashier on the default approval path.                                                     |
| **Municipal ladder**   | EO → CIC → VC → Chairperson — **most probably high-value works only** (`municipal_signoff_policy`). Short services skip ladder via guards.                                              |
| **Work order storage** | **Option A (locked):** linked `work_orders` table per application (ADR-0012 §9.1).                                                                                                      |
| **BOC**                | Unchanged: optional stage with guards (`boc_policy`). Orthogonal to EO/CIC/VC/Chairperson ladder.                                                                                       |

### Non-goals (this programme)

- Ward-scoped inspector routing or `ward_id` on `user_designations`
- State-published global designation library
- Department-first citizen home navigation
- Replacing the workflow engine or grievance role routing (separate future work)
- Keycloak realm role per designation

---

## 3. Data model

All tables are `tenant_id`-scoped with RLS consistent with `workflows` / `applications`.

### 3.1 Organisation

#### `tenant_departments`

| Column       | Type        | Notes                         |
| ------------ | ----------- | ----------------------------- |
| `id`         | UUID PK     |                               |
| `tenant_id`  | UUID FK     |                               |
| `code`       | VARCHAR(50) | Unique per tenant, kebab-case |
| `name`       | JSONB       | `{ en, bn, hi }`              |
| `is_active`  | BOOLEAN     |                               |
| `sort_order` | INT         | Admin UI ordering             |

**Unique:** `(tenant_id, code)`.

#### `tenant_designations`

| Column                 | Type        | Notes                                                                                                                  |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                   | UUID PK     |                                                                                                                        |
| `tenant_id`            | UUID FK     |                                                                                                                        |
| `code`                 | VARCHAR(80) | ULB-defined; unique per tenant                                                                                         |
| `name`                 | JSONB       | Display name for Desk / citizen “Pending at”                                                                           |
| `scope`                | VARCHAR(20) | `department` \| `municipality`                                                                                         |
| `department_id`        | UUID FK?    | Required when `scope = department`                                                                                     |
| `is_active`            | BOOLEAN     |                                                                                                                        |
| `is_department_head`   | BOOLEAN     | Default false; **true** for exactly one head per dept (e.g. Executive Engineer for PWD) — may **reject** in dept chain |
| `can_reject_municipal` | BOOLEAN     | Default false; **true** for `chairperson` (municipality scope) — may **reject** on ladder                              |

**Unique:** `(tenant_id, code)`.

Examples (one ULB may use different codes):

| code                   | scope          | department                                                                  |
| ---------------------- | -------------- | --------------------------------------------------------------------------- |
| `hoarding_clerk`       | `department`   | Advertising & Hoarding                                                      |
| `hoarding_inspector`   | `department`   | Advertising & Hoarding                                                      |
| `hoarding_officer`     | `department`   | Advertising & Hoarding — **department head** (issues deferred payment link) |
| `executive_officer`    | `municipality` | —                                                                           |
| `board_of_councillors` | `municipality` | —                                                                           |

#### `user_designations`

| Column           | Type    | Notes   |
| ---------------- | ------- | ------- |
| `id`             | UUID PK |         |
| `tenant_id`      | UUID FK |         |
| `user_id`        | UUID FK | `users` |
| `designation_id` | UUID FK |         |

**Unique:** `(tenant_id, user_id, designation_id)`.

A user may have many rows (Inspector + Officer). No `ward_id` on this table for v1 of this spec.

### 3.2 Catalogue (Option A)

#### `tenant_service_categories`

| Column          | Type        | Notes                    |
| --------------- | ----------- | ------------------------ |
| `id`            | UUID PK     |                          |
| `tenant_id`     | UUID FK     |                          |
| `department_id` | UUID FK     |                          |
| `code`          | VARCHAR(50) | Unique per tenant + dept |
| `name`          | JSONB       |                          |
| `is_active`     | BOOLEAN     |                          |
| `sort_order`    | INT         |                          |

**Unique:** `(tenant_id, department_id, code)`.

#### `tenant_services` (changes)

| Column / change        | Notes                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `category_id`          | FK → `tenant_service_categories` (replaces FK to global category only) |
| `department_id`        | Denormalized from category for indexes/APIs                            |
| `global_category_code` | VARCHAR(50) — one of 14 codes (`adv`, `cert`, …) for citizen filter    |

Global `service_categories` and `global_services` remain for State library and seeding. On adopt, tenant picks **department** + creates/links a **tenant_service_category**.

### 3.3 Workflow definition (extend existing tables)

During migration, **both** role and designation columns may be populated; evaluator prefers designation when set.

#### `workflow_stages`

| Column              | Type         | Notes                                      |
| ------------------- | ------------ | ------------------------------------------ |
| `owner_designation` | VARCHAR(80)? | Primary actor for “pending at” when set    |
| `owner_role`        | VARCHAR(80)  | Legacy; used when `owner_designation` null |

#### `workflow_transitions`

| Column              | Type         | Notes                                                                                                           |
| ------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| `actor_designation` | VARCHAR(80)? |                                                                                                                 |
| `actor_role`        | VARCHAR(80)  | Legacy                                                                                                          |
| `guard`             | JSONB?       | BOC, high-value, payment-paid — see §5, §8                                                                      |
| `stage_kind`        | VARCHAR(20)? | `maker` \| `checker` \| `approver` \| `dept_head` \| `municipality` \| `post_approval` \| `citizen` \| `system` |
| `allowed_verbs`     | JSONB?       | Default `["forward","return"]`; dept_head / chairperson add `reject`                                            |

#### `designation_stage_map` (new; parallel to `role_stage_map`)

| Column             | Type    |
| ------------------ | ------- |
| `tenant_id`        | UUID    |
| `stage_id`         | UUID FK |
| `designation_code` | VARCHAR |
| `can_view`         | BOOLEAN |
| `can_act`          | BOOLEAN |

**Unique:** `(tenant_id, stage_id, designation_code)`.

Keep `role_stage_map` until role-based workflows are retired.

#### `applications` (runtime)

| Column                | Type         | Notes                         |
| --------------------- | ------------ | ----------------------------- |
| `pending_designation` | VARCHAR(80)? | Next actor for migrated flows |
| `pending_role`        | VARCHAR(80)? | Legacy                        |

`application_timeline` gains optional `actor_designation`; retain `actor_role` for audit compat.

---

## 4. Actor resolution

### 4.1 Types (`@enagar/workflow`)

Extend definitions (names illustrative):

```ts
type WorkflowActor =
  | { kind: 'citizen' }
  | { kind: 'system' }
  | { kind: 'designation'; code: string }
  | { kind: 'role'; code: string }; // legacy

interface WorkflowStage {
  code: string;
  label: WorkflowLabel;
  owner: WorkflowActor;
  sla_hours?: number;
  initial?: boolean;
  terminal?: boolean;
}

interface WorkflowTransition {
  from: string;
  to: string;
  verb: string;
  actor: WorkflowActor;
  requires_comment?: boolean;
  guard?: TransitionGuard;
  effects?: WorkflowEffect[];
}
```

DB columns map to `owner` / `actor` at load time: if `owner_designation` set → designation; else → role.

### 4.2 Staff principal

For Desk/API staff requests:

1. Load `designation_codes[]` from `user_designations` for `(tenant_id, user.id)`.
2. `actor_roles` legacy set = JWT roles (`tenant_clerk`, …).
3. `evaluateTransition` succeeds if:
   - transition actor is `citizen` / `system` as today, or
   - actor is designation and `code ∈ designation_codes`, or
   - actor is role and `code ∈ actor_roles` (legacy).

### 4.3 Desk queue (`queue=my`)

Include application when:

```text
(pending_designation IS NOT NULL AND pending_designation ∈ user.designation_codes)
OR
(pending_designation IS NULL AND pending_role ∈ normalized JWT roles)
```

Admins (`tenant_admin` / `municipality_admin`) may still use `queue=all` per existing Desk rules.

### 4.4 Citizen “Pending at”

Display: `{designation.name.en} — {department.name.en}` when `pending_designation` set; else legacy role label mapping.

### 4.5 Transition verbs and permissions

Extend the process vocabulary ([glossary §10](./glossary.md)) for designation workflows:

| Verb                      | Meaning                                                    | Typical actor                                                                                                          |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **forward**               | Move to the next stage in the approval or municipal ladder | Maker, checker, approver, EO, CIC, VC, Chairperson                                                                     |
| **return**                | Move to the **previous internal** stage (not citizen)      | Same as forward — one step back on the graph edge                                                                      |
| **return-for-correction** | Send to citizen for edits                                  | Any dept stage (existing)                                                                                              |
| **reject**                | Terminal failure with comment                              | **Department head** (`is_department_head`) in dept chain; **Chairperson** (`can_reject_municipal`) on municipal ladder |
| **submit** / **withdraw** | Citizen                                                    | Unchanged                                                                                                              |

**Evaluator rules:**

1. If `verb === 'reject'`, actor designation must have `is_department_head` (current stage in dept scope) **or** `can_reject_municipal` (current stage is chairperson-approval).
2. If `verb === 'return'`, transition must exist as an explicit edge `from → to` (reverse of forward spine).
3. `forward` on municipal stages is allowed only when `municipal_signoff_policy` guard passes (§8).

**Stage kinds (`stage_kind`):**

| Kind                 | Purpose                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `maker`              | First officer processing                                                                                 |
| `checker`            | Second-line verification                                                                                 |
| `approver`           | Senior officer before head                                                                               |
| `dept_head`          | Department head (e.g. Executive Engineer); may reject; forwards to municipal ladder when policy requires |
| `municipality`       | EO, CIC, VC, Chairperson ladder stages                                                                   |
| `post_approval`      | Payment link, work order, assignment                                                                     |
| `citizen` / `system` | Unchanged                                                                                                |

---

## 5. Board of Councillors (BOC)

### 5.1 Service policy

Stored on `tenant_services.override_config` (or dedicated column later):

```json
{
  "boc_policy": "never" | "always" | "officer_may_require"
}
```

| Policy                | Behaviour                                                               |
| --------------------- | ----------------------------------------------------------------------- |
| `never`               | Guards prevent entering `boc-resolution` stage                          |
| `always`              | After scrutiny, only transition into BOC (then executive)               |
| `officer_may_require` | Scrutiny officer sets `runtime_snapshot.requires_boc_resolution = true` |

### 5.2 Workflow graph (single published version)

Include stage e.g. `boc-resolution` with `owner_designation = board_of_councillors` (municipality scope).

Example linear spine with branch:

```text
submitted (citizen)
  → clerk-verification (hoarding_clerk)
  → site-inspection (hoarding_inspector)
  → technical-scrutiny (hoarding_officer)
  → [guard] boc-resolution (board_of_councillors)   # only if requires_boc
  → executive-approval (executive_officer)
  → payment-pending (hoarding_officer; effect generate_payment_link, fee_code approval)
  → payment-received (system; guard payment_paid)
  → certificate-issued (terminal, certificate effect)
```

### 5.3 Guards (recommended approach)

Transition guard JSON on edges leaving `technical-scrutiny`:

```json
{
  "type": "boc_required",
  "when_true_verb": "route-to-boc",
  "when_false_verb": "approve-to-executive"
}
```

Evaluator checks `application.runtime_snapshot.requires_boc_resolution` and `service.boc_policy`.

### 5.4 BOC sign-off transition

Verb e.g. `record-boc-resolution`. Requirements when `boc_policy` ≠ `never`:

- `resolution_number` (string)
- `resolution_date` (date)
- Optional document: `application_documents.document_code = boc_resolution`, scan-clean before transition if upload required

Timeline + audit row; then move to `executive-approval` or terminal per graph.

### 5.5 Officer may require

At `technical-scrutiny`, transition payload may include:

```json
{ "require_boc": true }
```

API sets `runtime_snapshot.requires_boc_resolution` when policy is `officer_may_require`. Reject if policy is `never` and `require_boc` is true.

> BOC is **separate** from the EO → CIC → VC → Chairperson ladder. A service may use neither, one, or both (with guards).

---

## 6. Citizen catalogue API

**Unchanged navigation:** 14 global categories (`cert`, `adv`, …).

**New optional filter:**

```http
GET /api/services/catalogue?tenant_code=…&category=adv&department_id=<uuid>
```

- Without `department_id`: all active tenant services in global category `adv`.
- With `department_id`: subset where `tenant_services.department_id` matches.

Citizen PWA: category screen as today; add department chip/dropdown when tenant has multiple departments offering services in that category.

---

## 7. Workflow patterns (templates)

### 7.1 Pattern B — Works / PWD (maker–checker–municipal ladder–return–execution)

**Departments:** Public Works, Building Plan, Water Works (capital), Disaster (high value), etc.  
**Municipal sign-off:** Usually `high_value_only` (§8).

**Municipality designations (tenant-defined codes):**

| Display                 | Suggested `code`    | `can_reject_municipal` |
| ----------------------- | ------------------- | ---------------------- |
| Executive Officer       | `executive_officer` | false                  |
| Commissioner in Council | `cic`               | false                  |
| Vice-Chairperson        | `vice_chairperson`  | false                  |
| Chairperson             | `chairperson`       | **true**               |

**Department chain (PWD example):**

| Stage code         | `stage_kind` | Owner designation                               | Verbs                                  |
| ------------------ | ------------ | ----------------------------------------------- | -------------------------------------- |
| `submitted`        | `citizen`    | `citizen`                                       | submit                                 |
| `maker-review`     | `maker`      | `pwd_junior_engineer`                           | forward, return-for-correction         |
| `checker-review`   | `checker`    | `pwd_assistant_engineer`                        | forward, return → maker                |
| `approver-review`  | `approver`   | `pwd_assistant_engineer` or AE                  | forward, return → checker              |
| `dept-head-review` | `dept_head`  | `pwd_executive_engineer` (`is_department_head`) | forward, return → approver, **reject** |

**Municipal forward** (guard: `municipal_signoff_required`):

```text
dept-head-review --forward--> eo-approval --forward--> cic-approval --forward--> vc-approval --forward--> chairperson-approval
```

**Municipal return** (after Chairperson forwards approval down):

```text
chairperson-approval --return--> vc-approval --return--> cic-approval --return--> eo-approval --return--> dept-head-final
```

**Post-approval** (§9; dept head only for payment link):

```text
dept-head-final --forward--> payment-pending (effect: generate_payment_link)
  → payment-received (guard: paid)
  → work-order-issued
  → work-in-progress
  → work-completed
  → citizen-feedback
  → closed
```

When `municipal_signoff_policy = never` or fee below threshold, `dept-head-review --forward-->` skips ladder directly to `dept-head-final` or `payment-pending` per service template.

### 7.2 Pattern C — Advertising / Hoarding (scrutiny + optional BOC)

| Stage code           | Owner designation      | Notes                                                              |
| -------------------- | ---------------------- | ------------------------------------------------------------------ |
| `submitted`          | `citizen`              |                                                                    |
| `clerk-verification` | `hoarding_clerk`       | forward / return                                                   |
| `site-inspection`    | `hoarding_inspector`   |                                                                    |
| `technical-scrutiny` | `hoarding_officer`     |                                                                    |
| `boc-resolution`     | `board_of_councillors` | Guard §5                                                           |
| `executive-approval` | `executive_officer`    | May use short municipal path                                       |
| `payment-pending`    | `hoarding_officer`     | Dept head issues citizen payment link (`deferred_only` / ADR-0013) |
| `payment-received`   | `system`               | Guard `payment_paid` (`fee_code: approval`)                        |
| `certificate-issued` | terminal               | After approval fee settled                                         |

### 7.3 Pattern A — Certificate / licence (shorter dept chain)

Birth & Death, Trade licence: maker → checker → dept head → certificate (no municipal ladder unless `always` policy).

### 7.4 Pattern D — Tax / collection

Assessment → Collection: cross-department handoff via **forward** to next department’s maker stage (separate service link or single workflow with dept-scoped stages — tenant choice at publish time).

---

## 8. Municipal sign-off policy

On `tenant_services.override_config`:

```json
{
  "municipal_signoff_policy": "never" | "high_value_only" | "always",
  "municipal_signoff_threshold_paise": 50000000
}
```

| Policy            | Behaviour                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `never`           | No EO/CIC/VC/Chairperson stages; dept head proceeds to post-approval or certificate                     |
| `high_value_only` | Ladder required when `computed_fee_paise >= threshold` or form flag `requires_municipal_signoff = true` |
| `always`          | Ladder mandatory for every application of this service                                                  |

Guard on edge leaving `dept-head-review`:

```json
{
  "type": "municipal_signoff_required",
  "when_true_verb": "forward-to-eo",
  "when_false_verb": "forward-to-dept-head-final"
}
```

---

## 9. Post-approval execution (ADR-0012)

After municipal return completes, **department head** issues the citizen **payment link** (not Accounts/Cashier on the default path).

### 9.1 Work orders — Option A (locked)

**Decision (2026-05-29):** Execution is modeled as a **`work_orders` row linked to `applications`**, not a `lifecycle_phase` flag on the application alone. The citizen still tracks one **docket**; the work order is the operational child record for assignment, vendor, and completion.

#### `work_orders`

| Column             | Type         | Notes                                                                            |
| ------------------ | ------------ | -------------------------------------------------------------------------------- |
| `id`               | UUID PK      |                                                                                  |
| `tenant_id`        | UUID FK      | RLS                                                                              |
| `application_id`   | UUID FK      | Unique per application for v1 (one WO per approval)                              |
| `work_order_no`    | VARCHAR      | Human-readable, e.g. `WO/<tenant>/<year>/<seq>`                                  |
| `status`           | VARCHAR      | `draft` \| `issued` \| `assigned` \| `in_progress` \| `completed` \| `cancelled` |
| `assigned_user_id` | UUID FK?     | Internal staff                                                                   |
| `vendor_id`        | UUID FK?     | Registered vendor (tenant registry)                                              |
| `assigned_at`      | TIMESTAMPTZ? |                                                                                  |
| `completed_at`     | TIMESTAMPTZ? |                                                                                  |
| `metadata`         | JSONB        | Site notes, estimates, etc.                                                      |

**Unique (v1):** `(tenant_id, application_id)`.

Workflow transition effect `create_work_order` inserts the row when entering `work-order-issued`. Stage `work-in-progress` reads/updates this row. Re-assignment updates `assigned_user_id` / `vendor_id` on the same row (or future `work_order_assignments` if history is required).

> **Rejected alternative:** `applications.runtime_snapshot.lifecycle_phase` only — insufficient for vendor reporting and re-assignment audit.

### 9.2 Stages and effects

> **Payment timing per service** is not universal: see [ADR-0013](../ADRs/ADR-0013-service-payment-schedule.md) (`upfront_only`, `deferred_only`, `upfront_and_deferred` + `fee_code` on payments). The table below is the **deferred / approval-fee** path (e.g. trade licence after scrutiny).

| Stage               | Owner                                 | Verb / guard                                                                  |
| ------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `payment-pending`   | dept head designation                 | `forward` + effect `generate_payment_link` (payload `fee_code: approval`)     |
| `payment-received`  | `system`                              | guard `payment_paid` (optional `fee_code`; default = all required lines paid) |
| `work-order-issued` | `system`                              | effect `create_work_order`                                                    |
| `work-in-progress`  | assignee designation or vendor portal | `forward` when complete                                                       |
| `work-completed`    | assignee                              | `forward`                                                                     |
| `citizen-feedback`  | `citizen`                             | rating / comment                                                              |
| `closed`            | terminal                              |                                                                               |

### 9.3 Vendors

Assignment references **tenant vendor registry** (existing `vendor-reg` catalogue direction). Row on `work_orders.vendor_id` or `work_order_assignments`.

---

## 10. Implementation phases

| Phase | Deliverable                                                                       | Verify                                                       |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1     | Org tables + Masters CRUD (dept, designation, user assignments)                   | Assign 2 designations to one user                            |
| 2     | `tenant_service_categories` + service FK + `global_category_code`                 | Hoarding service under hoarding dept                         |
| 3     | Workflow columns + `designation_stage_map`; dual-read in Prisma loaders           | Publish draft workflow with designations                     |
| 4     | `@enagar/workflow` evaluator + guards; `pending_designation` on submit/transition | Unit tests green                                             |
| 5     | Desk union queue + citizen pending-at label                                       | Two designations → two stage types in my queue               |
| 6     | Catalogue `department_id` filter                                                  | `adv` + dept returns only hoarding services                  |
| 7     | BOC policy + guards + resolution transition                                       | Branch tests: never / always / officer_may_require           |
| 8     | `forward` / `return` / `reject` evaluator + `stage_kind` + head/chairperson flags | Reject denied for clerk; return edge works                   |
| 9     | `municipal_signoff_policy` guards + EO/CIC/VC/Chairperson template block          | High-value takes ladder; low-value skips                     |
| 10    | Pilot: Hoarding E2E (Pattern C)                                                   | `pnpm smoke:phase10` — BOC + skip-BOC + Desk UI              |
| 11    | Post-approval stages + `generate_payment_link` (dept head only)                   | `pnpm smoke:phase11`; `@enagar/workflow` payment guard tests |
| 12    | `work_orders` + vendor assign + feedback stage                                    | PWD Pattern B smoke                                          |
| 13    | Per-service payment schedule (ADR-0013)                                           | `pnpm smoke:phase13-matrix`                                  |
| 14    | Seed Appendix B designations + State onboarding org import                        | `pnpm smoke:phase14-org`                                     |

**Legacy:** Services with only `owner_role` / `pending_role` unchanged until workflow republished with designations.

---

## 11. Migration rules

1. **Additive migrations first** — add nullable designation columns; do not drop role columns.
2. **Dual-write** — on publish, populate designation fields; keep role fields for compat if needed (`tenant_clerk` mirror) until service marked migrated.
3. **Per-service flag** — `tenant_services.override_config.workflow_actor_model: "role" | "designation"` (default `role` for existing rows).
4. **In-flight applications** — snapshot `workflow_version`; old apps keep evaluating with role columns from snapshotted workflow version.
5. **Staff** — existing `user_roles` remain for Keycloak/login; add `user_designations` for Desk on migrated services.

---

## 12. Admin UI touchpoints

| Surface                  | Change                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| Tenant Admin **Masters** | Departments, designations, assign designations to staff (multi-select)            |
| **Service designer**     | Stage/transition actor picker: designation codes for tenant; citizen/system fixed |
| **Operations**           | `designation_stage_map` editor (mirror role-stage UI)                             |
| **Desk**                 | Queue labels show designation name; BOC transition form for resolution fields     |
| **Service config**       | `boc_policy`, `municipal_signoff_policy`, threshold                               |
| **Service designer**     | Forward/return edge pairs; municipal ladder block template                        |

---

## 13. Security

- All new tables in `tests/security/tenant-isolation.spec.ts`.
- Cross-tenant designation assignment forbidden (API + RLS).
- BOC documents subject to same upload/scan rules as other `application_documents`.
- Coarse JWT roles still required for Desk route access; designations alone do not grant portal login.

---

## Appendix A — Standard tenant departments (seed)

ULB may rename display labels; `code` is kebab-case unique per tenant.

| #   | English name                               | Suggested `code`         |
| --- | ------------------------------------------ | ------------------------ |
| 1   | Public Works Department                    | `public-works`           |
| 2   | Water Works Department                     | `water-works`            |
| 3   | Public Health and Convenience              | `public-health`          |
| 4   | Birth and Death                            | `birth-death`            |
| 5   | Collection Department                      | `collection`             |
| 6   | Certificate for Enlistment of Trade        | `trade-licence`          |
| 7   | Assessment Department                      | `assessment`             |
| 8   | General Department                         | `general`                |
| 9   | Accounts Department                        | `accounts`               |
| 10  | Health                                     | `health`                 |
| 11  | Conservancy / Sanitation                   | `conservancy`            |
| 12  | Environment / Solid Waste Management (SWM) | `swm`                    |
| 13  | Vehicle / Transport Section                | `transport`              |
| 14  | Building Plan / Building Department        | `building`               |
| 15  | Market Department                          | `market`                 |
| 16  | Store / Purchase Department                | `stores`                 |
| 17  | IT & Planning Section                      | `it-planning`            |
| 18  | NUHM                                       | `nuhm`                   |
| 19  | NULM                                       | `nulm`                   |
| 20  | PMAY                                       | `pmay`                   |
| 21  | Advertisement & Hoarding Cell              | `advertisement-hoarding` |
| 22  | Parking Management Cell                    | `parking`                |
| 23  | Disaster Management Cell                   | `disaster`               |
| 24  | Procurement & Stores                       | `procurement`            |

---

## Appendix B — Sample designations (partial seed)

Codes are **examples**; ULB defines final codes. `H` = `is_department_head`, `R` = `can_reject_municipal`.

### Public Works (`public-works`)

| name               | code                     | H   |
| ------------------ | ------------------------ | --- |
| Junior Engineer    | `pwd_junior_engineer`    |     |
| Assistant Engineer | `pwd_assistant_engineer` |     |
| Executive Engineer | `pwd_executive_engineer` | H   |

### Water Works (`water-works`)

| name                    | code                           |
| ----------------------- | ------------------------------ |
| Assistant Engineer      | `water_assistant_engineer`     |
| Sub-Assistant Engineer  | `water_sub_assistant_engineer` |
| Pump Operator           | `water_pump_operator`          |
| Water Supply Supervisor | `water_supply_supervisor`      |
| Meter Reader            | `water_meter_reader`           |

### Assessment (`assessment`)

| name                 | code                           |
| -------------------- | ------------------------------ |
| Assessment Officer   | `assessment_officer`           |
| Revenue Officer      | `assessment_revenue_officer`   |
| Dealing Assistant    | `assessment_dealing_assistant` |
| Assessment Inspector | `assessment_inspector`         |
| Tax Surveyor         | `assessment_tax_surveyor`      |
| Data Entry Operator  | `assessment_data_entry`        |

### Collection (`collection`)

| name              | code                           |
| ----------------- | ------------------------------ |
| Revenue Officer   | `collection_revenue_officer`   |
| Tax Collector     | `collection_tax_collector`     |
| Collection Sarkar | `collection_sarkar`            |
| Cashier           | `collection_cashier`           |
| Dealing Assistant | `collection_dealing_assistant` |

### Trade licence (`trade-licence`)

| name                | code                      |
| ------------------- | ------------------------- |
| License Inspector   | `trade_license_inspector` |
| License Clerk       | `trade_license_clerk`     |
| Revenue Officer     | `trade_revenue_officer`   |
| Data Entry Operator | `trade_data_entry`        |

### Birth & Death (`birth-death`)

| name                    | code                    |
| ----------------------- | ----------------------- |
| Registrar Birth & Death | `bd_registrar`          |
| Sub-Registrar           | `bd_sub_registrar`      |
| Registration Clerk      | `bd_registration_clerk` |
| Data Entry Operator     | `bd_data_entry`         |

### Health (`health`)

| name                    | code                        |
| ----------------------- | --------------------------- |
| Health Officer          | `health_officer`            |
| Sanitary Inspector      | `health_sanitary_inspector` |
| Public Health Inspector | `health_public_inspector`   |
| Medical Officer         | `health_medical_officer`    |
| Pharmacist              | `health_pharmacist`         |
| Lab Technician          | `health_lab_technician`     |

### Conservancy / SWM (`conservancy`, `swm`)

| name                  | code                              |
| --------------------- | --------------------------------- |
| Conservancy Inspector | `conservancy_inspector`           |
| Sanitary Supervisor   | `conservancy_sanitary_supervisor` |
| SWM Supervisor        | `swm_supervisor`                  |
| Conservancy Mazdoor   | `conservancy_mazdoor`             |
| Driver                | `conservancy_driver`              |
| Sweeper               | `conservancy_sweeper`             |

### Municipality-wide

| name                    | code                | R   |
| ----------------------- | ------------------- | --- |
| Executive Officer       | `executive_officer` |     |
| Commissioner in Council | `cic`               |     |
| Vice-Chairperson        | `vice_chairperson`  |     |
| Chairperson             | `chairperson`       | R   |

Other departments (General, Accounts, NUHM, NULM, PMAY, IT, Disaster, Procurement, Market, Building, Parking, etc.) — designations added via Tenant Admin Masters when services go live.

---

## 14. Related documents

- [ADR-0011](./ADRs/ADR-0011-org-designations-dept-catalogue.md)
- [ADR-0012](./ADRs/ADR-0012-post-approval-execution.md)
- [ADR-0004](./ADRs/ADR-0004-workflow-engine.md)
- [Programme backlog](./backlog/org-designations-programme.md)
- [Glossary §1, §4, §5, §10](./glossary.md)
- [Service catalogue](./service-catalogue.md)
