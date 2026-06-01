# Programme backlog — Departments, designations, and dept-scoped catalogue

> **ADR:** [ADR-0011](../ADRs/ADR-0011-org-designations-dept-catalogue.md) · [ADR-0012](../ADRs/ADR-0012-post-approval-execution.md)  
> **Spec:** [`docs/workflow-designations.md`](../workflow-designations.md) (v0.2)  
> **Status:** Phase 1–13 implemented in-repo (2026-05-31).

## Sponsor decisions (locked)

- Option A tenant categories per department
- Global 14 categories + `department_id` filter on citizen catalogue
- ULB-defined designation codes (no State library); seed Appendix A–B in spec
- Multi-designation Desk queue (union)
- No ward-scoped inspector routing
- Legacy `tenant_clerk` / `tenant_admin` workflows until per-service migration
- BOC: stage in graph; guards + `boc_policy`
- **Forward / return** internal chain; **reject** = dept head + Chairperson only
- **Payment link:** department head after municipal return (not Accounts/Cashier on path)
- **Municipal ladder** EO → CIC → VC → Chairperson: `municipal_signoff_policy` (default **high_value_only**)
- **Work orders (Option A):** linked `work_orders` table per application (ADR-0012 §9.1) — **locked**

## Implementation checklist

### Org & catalogue (ADR-0011)

- [x] **Phase 1** — Prisma: `tenant_departments`, `tenant_designations` (+ `is_department_head`, `can_reject_municipal`), `user_designations` + RLS + Masters UI + seed (24 depts, KMC sample designations)
- [x] **Phase 2** — `tenant_service_categories`; `services.department_id` + `global_category_code`; citizen `GET /services/tenants/:code?global_category=&department_id=`; adopt/seed paths
- [x] **Phase 3** — Workflow columns `*_designation`, `stage_kind`, `allowed_verbs`, `guard`; `designation_stage_map`; dual-read Prisma loaders; `pending_designation` on submit
- [x] **Phase 4** — `@enagar/workflow` designation + legacy role evaluator; desk passes `actor_designations`; `pending_designation` on transition; guards + reject capability checks
- [x] **Phase 5** — Desk union queue (SQL + union filter); citizen `pending_at_label`; `GET /services/catalogue?tenant_code=&category=&department_id=`; PWA category/department browse
- [x] **Phase 6** — Designer: designation picker, forward/return edges, municipal block template (`service-designer-client`, `workflow-designer-templates.ts`)
- [x] **Phase 7** — BOC policy UI + guards (`boc_policy` on service config, guarded hoarding template, desk BOC fields, `@enagar/workflow` policy helpers)

### Approval patterns (v0.2 spec)

- [x] **Phase 8** — Verbs `forward` / `return` / `reject` rules; head + chairperson reject tests (`@enagar/workflow` evaluator, desk comment on reject, `scripts/smoke/phase8-desk-reject-return-smoke.mjs`)
- [x] **Phase 9** — `municipal_signoff_policy` + high-value guard; PWD ladder publish (Pattern B); `applyPwdWorksTemplate`, desk guard preview, `pnpm smoke:phase9`
- [x] **Phase 10** — Pilot Pattern C: Advertising & Hoarding E2E (`scripts/smoke/phase10-hoarding-e2e-smoke.mjs`, `pnpm smoke:phase10`)

### Post-approval (ADR-0012)

- [x] **Phase 11** — `generate_payment_link` (dept head only); `payment_paid` guard + auto-advance; `pnpm smoke:phase11`
- [x] **Phase 12** — `work_orders` (+ vendor assign) + citizen feedback stage; `pnpm smoke:phase12-pwd`
- [x] **Phase 13** — Per-service **payment schedule** (ADR-0013): upfront / deferred / dual fee (`fee_code`, submit gates)
  - [x] **13A** — `payment_schedule` + `fee_lines` on service config; admin-tenant validation; designer panel; catalogue seed defaults
  - [x] **13B** — `payments.fee_code`; `fee_settlement` snapshot; migrate rollup `payment_status`
  - [x] **13C** — Submit gate `application_fee_paid`; citizen PWA fee breakdown + upfront pay-before-submit; `pnpm smoke:phase13-upfront`, `pnpm smoke:phase13-dual`
  - [x] **13D** — Effect/guard `fee_code`; desk link for `approval`; dual-fee smoke; citizen approval blocked until desk link
  - [x] **13E** — Schedule-driven draft defaults; legacy snapshot hydration; regression matrix (`pnpm smoke:phase13-matrix`)
- [x] **Phase 14** — Seed Appendix B designations; onboarding import JSON for pilot ULB (`pnpm smoke:phase14-org`)

## Verification

- `tests/security/tenant-isolation.spec.ts` — all new tables
- Designation + legacy role transitions
- BOC branches (`never` / `always` / `officer_may_require`)
- Municipal ladder skipped when below threshold; taken when high-value
- Reject: succeeds for head/chairperson; 403 for clerk on `reject`
- Return: walks back one internal stage
- Payment link: only `is_department_head`; work order blocked until paid
- Payment schedule: upfront submit blocked until application fee paid; deferred/dual approval line at desk only (ADR-0013)
- Catalogue `department_id` filter

## Reference templates

| Pattern | Use case                                      | Spec § |
| ------- | --------------------------------------------- | ------ |
| A       | Certificate / licence                         | 7.3    |
| B       | PWD / works + municipal ladder + payment + WO | 7.1    |
| C       | Hoarding / advertising                        | 7.2    |
| D       | Assessment → collection                       | 7.4    |
