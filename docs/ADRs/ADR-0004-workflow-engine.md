# ADR-0004 — Workflow engine: Postgres-backed state machine with BullMQ workers

| Field               | Value                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**          | Accepted                                                                                                                                                             |
| **Date**            | 2026-05-07                                                                                                                                                           |
| **Decision-makers** | Project Technical Lead                                                                                                                                               |
| **Supersedes**      | _none_                                                                                                                                                               |
| **Superseded by**   | _none_                                                                                                                                                               |
| **Related**         | ADR-0001 (Postgres), ADR-0002 (NestJS), ADR-0005 (Hosting), ADR-0009 (Keycloak), ADR-0010 (External-data adapters), ADR-0011 (Designation actors — extends this ADR) |

## Context

Phase 2 turns eNagarSeba from a tenant-aware shell into a plug-and-play service
platform. Every municipal service needs a configurable approval path: stages,
transitions, role ownership, SLA timers, escalations, side effects, and a citizen
timeline. The core product promise is that a tenant admin can add or adjust a
service workflow through data, not code.

The workflow engine must satisfy these forces:

- **Tenant isolation**: all application and workflow runtime rows are
  tenant-scoped and must remain protected by Postgres RLS.
- **Configurability**: service workflows are authored as data and later managed
  in `apps/admin-tenant`; hard-coded service-specific React or NestJS flows are
  not acceptable.
- **Auditability**: every state transition must leave an immutable timeline row
  with actor, role, timestamp, previous stage, next stage, and reason/comment.
- **Operational simplicity**: per ADR-0005 the platform runs on-prem. The stack
  should avoid a heavy new control plane unless it clearly earns its cost.
- **Open-source mandate**: recurring software licence cost remains zero.
- **Async work**: SLA timers, escalations, notifications, document-scan
  callbacks, and idempotent side effects need background execution.

This decision is needed before Sprint 2.1 finalizes the catalogue/workflow schema
and before Sprint 2.3 implements applications and timelines.

## Decision

**eNagarSeba will use a Postgres-backed, data-defined workflow state machine
evaluated by `@enagar/workflow`, with BullMQ workers handling asynchronous side
effects, SLA timers, and escalations.**

Concretely:

1. **Definitions live in Postgres**: `workflows`, `workflow_stages`,
   `workflow_transitions`, `role_stage_map`, and related service-version tables
   are the source of truth. Tenant-specific overrides are additive/configured
   data, not code branches.
2. **Runtime state lives in Postgres**: `applications` stores the current stage
   and snapshot references; `application_timeline` records every transition and
   system event.
3. **Pure evaluation lives in `packages/workflow`**: it validates whether a
   transition is allowed, which role can perform it, which guards apply, and what
   side effects should be scheduled. It performs no I/O.
4. **API owns synchronous transitions**: NestJS endpoints validate the JWT role,
   tenant, application ownership, and transition request, then persist the state
   change in one transaction.
5. **Workers own async effects**: `services/workflow-engine` consumes BullMQ jobs
   for SLA timers, escalations, notifications, document-scan callbacks, and
   retryable side effects.
6. **Idempotency is mandatory**: side-effecting jobs key on
   `(tenant_id, application_id, transition_id, effect_type)` so replays cannot
   double-issue certificates, duplicate notifications, or repeat escalations.

The design intentionally keeps workflow semantics close to the application's
tenant-scoped data model. External workflow engines may still be used later for
technical integration orchestration, but they are not the primary citizen-service
workflow runtime.

## Alternatives considered

| Option                                                   | Pros                                                                                 | Cons                                                                                                    | Rejected because                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Postgres state machine + BullMQ workers**              | Best tenant/RLS fit; low ops cost; fully open-source; data-defined; easy audit trail | We own correctness, visual designer, transition tests, timer semantics, and idempotency discipline      | Accepted: it best matches the plug-and-play municipal-service model                                      |
| **Temporal**                                             | Excellent durability, retries, long-running workflows, and replay model              | Code-first workflows; harder tenant-admin configurability; extra control plane; less natural RLS fit    | Better for technical orchestration than tenant-authored municipal approval chains                        |
| **Camunda / BPMN engine**                                | Mature BPMN modeler; strong human-task vocabulary; process-monitoring features       | Heavy runtime; Camunda 8 production licensing is not zero-cost open-source; BPMN is more than v1 needs  | Violates cost/open-source posture and adds operational complexity before the project needs BPMN depth    |
| **Netflix Conductor / Orkes Conductor OSS**              | Apache 2.0; mature orchestration model; UI and task queues                           | Another distributed platform to operate; workflow model not centered on Postgres RLS or admin overrides | Useful for service orchestration, but too heavy for our current approval-chain and tenant-isolation need |
| **Lightweight JSON rules evaluated directly in the API** | Fastest v1; minimal infra                                                            | SLA timers, retries, escalations, idempotency, and audit boundaries become API concerns                 | Likely to be replaced by Phase 4/6; not robust enough as the ADR-level foundation                        |

## Consequences

### Positive

- **Plug-and-play remains true**: workflow changes are data/configuration, not
  redeploys.
- **Tenant isolation stays enforceable**: workflow definitions, applications,
  timeline rows, and jobs carry `tenant_id`; RLS remains the safety net.
- **Audit is first-class**: `application_timeline` becomes the durable record for
  citizen-visible status, staff actions, and dispute resolution.
- **Operational footprint is modest**: the project already uses Postgres, Redis,
  and BullMQ.
- **Testability improves**: pure transition evaluation can be unit-tested without
  NestJS, Redis, or Postgres.
- **Phase 6 admin designer remains possible**: the schema can later drive a
  visual workflow editor without changing the runtime.

### Negative / costs

- **We own workflow correctness**: transition validation, guard evaluation, SLA
  timer behavior, and idempotent side effects need strong tests.
- **No off-the-shelf BPMN modeler**: Phase 6 must build or adapt a visual editor
  on top of our schema.
- **Timer precision depends on BullMQ/Redis health**: the system must tolerate
  delayed jobs and recover by reconciling due SLA events from Postgres.
- **Schema design matters early**: poor version/snapshot semantics could break
  in-flight applications when a service form or workflow changes.

### Neutral / follow-ups required

- **Sprint 2.1**: add catalogue/workflow schema with versioning and tenant
  override semantics, but keep runtime execution minimal.
- **Sprint 2.2**: align form-schema versions with workflow versions so submitted
  applications keep snapshot semantics.
- **Sprint 2.3**: implement `@enagar/workflow`, `services/workflow-engine`,
  application transitions, timeline writes, and SLA job scheduling.
- **Phase 4**: reuse the same primitives for grievance workflows, adding field
  staff assignment and dispute windows where needed.
- **Phase 6**: build the tenant-admin workflow editor against the same schema.

## Compliance / verification

- **Schema contract tests**: security tests must assert every tenant-scoped
  workflow/application table has RLS enabled and a tenant-isolation policy.
- **Evaluator conformance tests**: `packages/workflow` must reject invalid
  transitions, wrong-role transitions, terminal-stage transitions, and guard
  failures.
- **API integration tests**: cross-tenant application IDs return 404, not 403 or
  200; citizen and operator roles can only execute allowed verbs.
- **Worker idempotency tests**: repeated BullMQ jobs with the same
  `(tenant_id, application_id, transition_id, effect_type)` produce one side
  effect.
- **SLA reconciliation job**: a scheduled worker scans Postgres for overdue
  stages so missed/delayed BullMQ timers are corrected.
- **Performance gate**: listing services for one tenant must remain under the
  Phase 2 target of 100 ms P95, and workflow metadata lookup must be cacheable
  without bypassing tenant scope.

## References

- `ROADMAP.md` — Phase 2 Service & Workflow Engine.
- `AGENT.md` §2 — plug-and-play configuration and open-source-only pillars.
- `AGENT.md` §7 — ADR status and open-decision handling.
- `ARCHITECTURE.md` §5 — Services, Applications, and Admin APIs.
- `docs/service-catalogue.md` §4 — workflow patterns and tenant override rules.
- `docs/glossary.md` §4 — application, workflow, stage, transition, SLA, and escalation vocabulary.
- `docs/ADRs/ADR-0011-org-designations-dept-catalogue.md` — departments, tenant categories, designation-based stages (extends actor model; engine unchanged).
- `docs/workflow-designations.md` — implementation spec for designation workflows, forward/return, municipal ladder, BOC guards, post-approval (v0.2).
- `docs/ADRs/ADR-0012-post-approval-execution.md` — payment link, work orders, vendors, feedback.
- `docs/security/threat-model.md` §4.8 and §7.1 — queue/idempotency and tenant-isolation threats.
- BullMQ documentation — <https://docs.bullmq.io/>
- Temporal documentation — <https://docs.temporal.io/>
- Camunda 8 licensing — <https://docs.camunda.io/docs/reference/licenses/>
- Conductor OSS — <https://github.com/conductor-oss/conductor>
