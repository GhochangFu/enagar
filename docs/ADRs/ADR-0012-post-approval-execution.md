# ADR-0012 — Post-approval execution: payment, work orders, vendors, and citizen feedback

| Field               | Value                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Status**          | Accepted                                                                                                           |
| **Date**            | 2026-05-29                                                                                                         |
| **Decision-makers** | Project Technical Lead                                                                                             |
| **Supersedes**      | _none_                                                                                                             |
| **Superseded by**   | _none_                                                                                                             |
| **Related**         | ADR-0004 (workflow engine), ADR-0006 (payments), ADR-0011 (org & designations), `docs/workflow-designations.md` §9 |

## Context

ULB service delivery does not end at municipal sign-off. For works-type services (e.g. Public Works), the approved application must support:

1. **Payment link** issued by the **department head** after the municipal return chain completes.
2. Citizen **payment** before execution starts.
3. **Work order** issuance and assignment to internal staff or **registered vendors**.
4. **Citizen feedback** after work completion.

ADR-0011 covers departments, designations, and approval-chain workflows. It intentionally deferred execution-phase data and APIs. Sponsor clarified (2026-05-29):

- Payment link: **department head only** (not Accounts/Cashier on the approval path).
- Reject during approval: **department head** and **Chairperson** (municipal ladder).
- Internal movement: **forward** and **return** between officer stages (not duplicate “approve”).
- Municipal ladder (EO → CIC → VC → Chairperson): **high-value works** by default, not every service.
- Work order storage: **Option A locked** — linked `work_orders` table (see `docs/workflow-designations.md` §9.1).

## Decision

**Post-approval execution remains on the same ADR-0004 workflow engine**, extended with additional stages, verbs, side effects, and a **`work_orders` table linked to `applications` (Option A)**, rather than a separate BPM product or application-only phase JSON.

Concretely:

1. **Same application docket** carries the citizen journey from submit through feedback; execution state is tracked via workflow stages **and** a `work_orders` child row (one per application in v1).
2. **Payment link** stage is owned by the department-head designation; transition effect `generate_payment_link` reuses the payment adapter (ADR-0006). Accounts/Cashier designations may record payments in finance modules but **do not** issue the citizen payment link on the approval path unless a future service explicitly adds that stage.
3. **Guards** block work-order creation until `payment_status = paid` (or `not_required` when fee is zero).
4. **Work order (Option A)** — table `work_orders` with `application_id`, `work_order_no`, `status`, `assigned_user_id`, `vendor_id`, timestamps; see spec §9.1 for column list.
5. **Vendor assignment** references tenant vendor registry (existing catalogue direction); `work_orders.vendor_id` for v1; `work_order_assignments` deferred unless re-assignment history is required.
6. **Citizen feedback** — terminal workflow stage or rating fields on application after `work-completed`.
7. **Municipal ladder** inclusion controlled per service via `municipal_signoff_policy` (`never` | `high_value_only` | `always`) evaluated against fee threshold / form flags — not hard-coded to PWD only.

## Alternatives considered

| Option                                    | Pros                                     | Cons                                     | Rejected because                   |
| ----------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------- |
| **Linked `work_orders` table (Option A)** | Clean audit; re-assign; vendor reporting | Extra migration                          | **Accepted**                       |
| **Application phase JSON only**           | Fewer tables                             | Heavy timeline; weak vendor reporting    | Rejected                           |
| **Separate “execution” application**      | Split concerns                           | Two docket numbers confuse citizens      | Poor UX                            |
| **Accounts issues payment link**          | Matches finance org chart                | Conflicts with sponsor “dept head first” | Rejected per sponsor clarification |

## Consequences

### Positive

- End-to-end PWD-style flows are documentable without leaving eNagarSeba’s data-defined model.
- Payment and certificate patterns from Phase 2/3 reuse adapters and timeline audit.

### Negative / costs

- Longer workflow graphs per service template; designer UX must support forward/return edges and municipal ladder blocks.
- Work-order + vendor modules are new build surface (programme phases 11+).

### Neutral / follow-ups

- Implement after ADR-0011 phases 1–7 (org + designation approval path).
- See `docs/backlog/org-designations-programme.md` phases 9–14.

## Compliance / verification

- Payment link transition tests: only dept-head designation; fails for clerk/EO.
- Guard tests: work order blocked until paid.
- Chairperson + dept-head reject tests; non-head forward-only reject denied.
- High-value guard: ladder skipped when policy `never` or below threshold.

## References

- [`docs/workflow-designations.md`](../workflow-designations.md) — §4.5, §8, §9, Appendix A.
- [`docs/ADRs/ADR-0011-org-designations-dept-catalogue.md`](./ADR-0011-org-designations-dept-catalogue.md).
