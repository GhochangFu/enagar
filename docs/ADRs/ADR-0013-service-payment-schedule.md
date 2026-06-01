# ADR-0013 — Per-service payment schedule (upfront, deferred, dual fee)

| Field               | Value                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Status**          | Proposed (2026-05-31)                                                                            |
| **Date**            | 2026-05-31                                                                                       |
| **Decision-makers** | Project Technical Lead + ULB sponsor (pending)                                                   |
| **Related**         | ADR-0006 (payments), ADR-0012 (post-approval), `docs/workflow-designations.md` §9, Phase 11 impl |

## Context

Phase 11 implemented **deferred** collection only: applications start with `payment_status: not_required` until the department head runs `generate_payment_link` at `payment-pending`. That matches trade licence / PWD post-approval paths but is wrong for other catalogue services.

Sponsor requirements (2026-05-31):

1. **Upfront only** — applicant pays before (or as part of) submit; no municipal approval needed to _start_ payment (e.g. simple registrations, instant-style services).
2. **Deferred only** — no payment at apply; ULB issues link later (current trade licence / works pattern).
3. **Dual fee** — **application fee** upfront at submit + **approval / licence fee** later, issued by municipal authorities mid-workflow.

Today the platform has a **single** `payment_status` on `applications`, one `fee_rule` / `effectiveFeeConfig` per service, and `Payment` rows without a fee line identifier. Community hall seed already hints at multiple amounts (`amount_paise` + `deposit_paise`) but settlement is not modeled per line.

## Decision

**Payment behaviour is configured per tenant service**, not hard-coded per service code. Workflow still controls _when_ a deferred line may be collected (stages + `generate_payment_link` effect); service config controls _which fee lines exist_ and _whether submit requires upfront settlement_.

### 1. Service config — `payment_schedule` + `fee_lines`

Add to `tenant_services.override_config` (and designer **Service config** panel):

```json
{
  "payment_schedule": "upfront_only" | "deferred_only" | "upfront_and_deferred",
  "fee_lines": {
    "application": {
      "label": { "en": "Application fee", "bn": "...", "hi": "..." },
      "rule": { "type": "fixed", "amount_paise": 500, "currency": "INR" }
    },
    "approval": {
      "label": { "en": "Licence fee", "bn": "...", "hi": "..." },
      "rule": { "type": "fixed", "amount_paise": 10000, "currency": "INR" }
    }
  }
}
```

| `payment_schedule`     | `application` line | `approval` line | Submit gate                      | ULB link stage                       |
| ---------------------- | ------------------ | --------------- | -------------------------------- | ------------------------------------ |
| `upfront_only`         | required           | absent          | `application` paid before submit | N/A                                  |
| `deferred_only`        | absent             | required        | none                             | `generate_payment_link` → `approval` |
| `upfront_and_deferred` | required           | required        | `application` paid before submit | desk issues `approval`               |

- **Backward compat:** If `payment_schedule` is omitted, infer:
  - `deferred_only` when published workflow contains `payment-pending` + `generate_payment_link`.
  - `upfront_only` when workflow has no post-approval payment block (Pattern A certificate, instant).
- Legacy single `fee_rule` maps to the primary line (`application` for upfront*, `approval` for deferred*) during migration.

\*For `upfront_only`, the lone line is `application`. Catalogue `fee_type` / `fee_config` remain the display default until fully migrated.

### 2. Application state — per-line status (not one `payment_status`)

Replace reliance on a single `payment_status` with a snapshot block (keep column `payment_status` as **rollup** for list APIs until Phase 13 cleanup):

```json
{
  "fee_settlement": {
    "application": { "status": "not_required" | "pending" | "paid" | "failed", "payment_id": "uuid?", "amount_paise": 500 },
    "approval": { "status": "not_required", "payment_id": null, "amount_paise": 10000 }
  }
}
```

**Rollup rules (citizen list / desk — keep `payment_status` column until Phase 13E cleanup):**

| Condition                                                     | Rollup `payment_status` |
| ------------------------------------------------------------- | ----------------------- |
| Any required line `pending`                                   | `pending`               |
| Any required line `failed`                                    | `failed`                |
| All required lines `paid`                                     | `paid`                  |
| Upfront `application` line unpaid (`not_required`)            | `not_required`          |
| Deferred/dual `approval` line not yet issued (`not_required`) | `not_required`          |

Implementation: `apps/api/src/modules/payments/fee-settlement.util.ts` (`rollupPaymentStatus`). Runtime snapshot stores per-line state under `fee_settlement`; list APIs continue to expose rollup `payment_status`.

### 3. Payments table — `fee_code`

Add nullable → required column on `payments`:

| Column     | Example       | Notes                                   |
| ---------- | ------------- | --------------------------------------- |
| `fee_code` | `application` | `approval`, future `deposit`, `penalty` |

Unique active attempt: `(application_id, fee_code)` where `status = requires_action`.

- Citizen `POST /payments/initiate` body adds `fee_code` (default `application` for upfront schedules).
- Desk `generate_payment_link` effect payload: `{ "fee_code": "approval" }` (default `approval` when schedule is deferred/dual).

### 4. Workflow (unchanged verbs, richer effects/guards)

| Mechanism                      | Change                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Effect `generate_payment_link` | Payload `fee_code`; issues link only for that line; sets that line to `pending`.             |
| Guard `payment_paid`           | Optional payload `fee_code`; if omitted, all **required** lines for schedule must be `paid`. |
| Guard `application_fee_paid`   | New: for submit transition from citizen (API middleware, not only graph).                    |

Workflow **templates** (designer):

- **Upfront certificate** — no `payment-pending` stage; citizen pays `application` on apply form.
- **Deferred / trade** — keep Phase 11 block; effect targets `approval`.
- **Dual** — same graph as deferred; submit blocked until `application` paid; `approval` link at `dept-head-final`.

### 5. API / UX flows

**Citizen PWA**

| Schedule               | Apply screen                              | After submit                                                            |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `upfront_only`         | Pay application fee → then Submit enabled | No payment section unless failed retry                                  |
| `deferred_only`        | No pay                                    | Pay only when `approval` link issued (`active_payment_id` + `fee_code`) |
| `upfront_and_deferred` | Pay application fee → Submit              | Second block appears at `payment-pending` for approval fee              |

**Desk**

- Forward → `payment-pending` runs `generate_payment_link` for `approval` line only.
- Desk detail shows both lines: Application fee ✓ paid, Licence fee ⏳ pending.

**Submit validation (`ApplicationsService.submitDraft`)**

```text
if schedule requires application line and application not paid → 400 Application fee not paid
```

### 6. Revenue / GL

Receipt + `gl_postings` already carry `revenue_head_code` / `accounting_code` from service. Extend mapping:

```json
"fee_lines": {
  "application": { "rule": {...}, "revenue_head_code": "trade-app", "accounting_code": "..." },
  "approval": { "rule": {...}, "revenue_head_code": "trade-lic", "accounting_code": "..." }
}
```

Fallback to service-level heads when line-level omitted.

## Alternatives considered

| Option                                  | Rejected because                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| Two separate services (apply + pay)     | One docket; citizen confusion; duplicate data                                  |
| Only workflow flags (no service config) | Same graph would need duplicating per service; fee amounts belong in catalogue |
| Multiple `payment_status` columns       | Does not scale; payment rows + `fee_code` are auditable                        |
| Single combined fee at submit for dual  | Cannot match “application now, licence after inspection” business rule         |

## Implementation phases

| Phase   | Scope                                                                                             | Verify                                                      |
| ------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **13A** | `payment_schedule` + `fee_lines` on service config; validation in admin-tenant; designer dropdown | Config PATCH round-trip                                     |
| **13B** | `payments.fee_code`; `fee_settlement` snapshot; migrate rollup `payment_status`                   | Unit + DB migration                                         |
| **13C** | Submit gate `application_fee_paid`; citizen PWA fee breakdown + upfront pay-before-submit         | Smoke: birth-cert upfront                                   |
| **13D** | Effect/guard `fee_code`; desk link for `approval`; dual-fee smoke                                 | trade-licence dual + approval gate                          |
| **13E** | Deprecate global “always not_required on draft”; schedule-driven defaults; legacy hydration       | `pnpm smoke:phase13-matrix` (upfront, dual, deferred, free) |

### Regression matrix (target)

| Service pattern       | Schedule                                  | Submit              | Later pay      |
| --------------------- | ----------------------------------------- | ------------------- | -------------- |
| Birth certificate     | `upfront_only`                            | Pay ₹X then submit  | —              |
| Trade licence         | `upfront_and_deferred` or `deferred_only` | App fee if dual     | Dept head link |
| PWD works             | `deferred_only`                           | No pay              | Dept head link |
| Property tax (future) | `computed` + schedule TBD                 | External calculator | —              |
| Free service          | `fee_lines` empty / free                  | Submit              | —              |

## Consequences

### Positive

- One payment adapter; clear rules per service without forking workflows per ULB.
- Dual fee matches real-world “processing fee + licence fee” without two dockets.
- Phase 11 desk link and citizen stub capture extend naturally via `fee_code`.

### Negative / cost

- Schema + snapshot migration; citizen/desk UI must show multiple lines.
- Existing trade-licence tenants need explicit `payment_schedule: deferred_only` (or infer from workflow).
- Computed/slab fees need per-line rules in a follow-up (13F).

### Neutral

- ADR-0012 post-approval stages unchanged; only payment _timing_ and _line_ are generalized.

## Open questions for sponsor

1. **Trade licence:** `deferred_only` (single licence fee after approval) or `upfront_and_deferred` (₹500 apply + ₹10 licence later)? Configurable per ULB.
2. **Upfront fail:** Allow draft save without pay, block only submit? (Recommended: yes.)
3. **Partial refunds:** Per `fee_code` refund in finance module — defer to deposits/refunds ADR scope.

## References

- Phase 11 implementation: `generate_payment_link`, `payment-pending`, `issueDeskPaymentLink`
- `docs/backlog/org-designations-programme.md` — add Phase 13 rows when accepted
- `docs/workflow-designations.md` §9.2 — cross-link after acceptance
