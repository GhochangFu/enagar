# ADR-0016 — Service Setup Assistant module boundaries (EN-52 / SSA)

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Status**          | Accepted (2026-06-22)                                                                           |
| **Date**            | 2026-06-22                                                                                      |
| **Decision-makers** | Project Technical Lead                                                                          |
| **Related**         | EN-52, ADR-0008 (LLM adapter), ADR-0004 (workflow), ADR-0014 (form import), EN-4 (global forms) |
| **Supersedes**      | _none_                                                                                          |

## Context

ULB `tenant_admin` users configure catalogue services across separate Service Designer panels (form schema, workflow definition, fee rules, documents, revenue mapping). State `state_admin` users curate global `form_schema` in the Service Library. Both require domain knowledge of workflow patterns, fee JSON, and designation stages.

The **Service Setup Assistant** (SSA) is an AI-guided step wizard embedded in `admin-tenant` and `admin-state` that helps staff configure **existing** catalogue services through typed LLM tools — auto-saving drafts while leaving publish as an explicit manual action.

Phase 7 **Sahayak** already ships a citizen-facing chatbot with `ChatbotLlmService`, `ILLMProvider`, SSE streaming, guardrails, and audit. SSA must reuse inference infrastructure without coupling to citizen RAG, consent flows, or publish semantics.

This ADR records module boundaries, LLM configuration, workflow regenerate behaviour, and the v1 service archetype catalog before implementation (SSA-1+).

**Implementation spec:** [`docs/superpowers/specs/2026-06-22-service-setup-assistant-design.md`](../superpowers/specs/2026-06-22-service-setup-assistant-design.md)

## Decision

**We add a new NestJS module `service-setup-assistant` with its own session store, tool registry, system prompts, and audit table. It reuses `ChatbotLlmService` / `ILLMProvider` for streaming inference but does not share Sahayak's RAG pipeline, citizen session model, or publish endpoints.**

### 1. Boundaries vs Sahayak citizen chatbot

| Concern                 | Service Setup Assistant                                          | Sahayak (`chatbot` module)       |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------- |
| **Actor**               | Staff (`staff_subject_id` + tenant JWT)                          | Citizen (optional auth)          |
| **Entry portals**       | `admin-tenant`, `admin-state`                                    | `citizen-pwa`                    |
| **Knowledge retrieval** | None in v1 (optional operator runbook RAG later)                 | Qdrant KB RAG                    |
| **Session binding**     | `service_setup_sessions` (tenant + service or global code)       | Citizen / anonymous chat session |
| **Writes**              | Draft PATCH via internal admin services only                     | Read-only citizen guidance       |
| **Auto-publish**        | **Never** — tools must not call publish endpoints                | N/A                              |
| **Audit**               | `service_setup_audit_logs` (tool name, step, staff)              | `chatbot_audit_logs`             |
| **PII handling**        | Field labels / schema metadata only; no application data         | `redactPii` on citizen queries   |
| **Guardrails**          | Block publish requests, cross-tenant access, validation bypass   | Citizen injection + PII patterns |
| **Consent / DPA**       | Reuse `tenants.config.chatbot.dpa_signed` gate on provider calls | `assertDpaAllowsProviderCall`    |

Staff sessions are audited under tenant admin RBAC (`assertTenantPortalStaff` / state admin guards). Citizen chat remains a separate product surface.

### 2. LLM provider configuration

SSA reuses ADR-0008 adapter precedence unchanged:

1. `tenants.config.chatbot.provider` (per-tenant override)
2. `LLM_PROVIDER` environment variable
3. Key-based / environment fallback (`openai` in production, `ollama` in local dev)

**DPA gate:** SSA calls `ChatbotLlmService.assertDpaAllowsProviderCall` before outbound inference, same as Sahayak. For local development without signed DPA:

```bash
SETUP_ASSISTANT_SKIP_DPA_DEV=true   # honoured when NODE_ENV !== 'production'
```

This mirrors `CHATBOT_DPA_SKIP_DEV` for Sahayak. Production deployments must not set either skip flag.

**Token budget (SSA-5):** Optional deployment cap:

```bash
SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION=50000   # unset = no hard cap
```

When set, the orchestration service accumulates `input_tokens + output_tokens` on the session row and hard-stops SSE with an `error` event at 100%. Warn at 80% in the chat UI.

No separate `SETUP_ASSISTANT_LLM_PROVIDER` in v1 — reuse `LLM_PROVIDER` to avoid operational drift. A dedicated env key may be added post-pilot if staff and citizen traffic need different models.

### 3. Autonomy and publish semantics

- **Auto-save drafts:** Each successful mutating tool validates then PATCHes the existing draft API (`form-draft`, `workflow-draft`, `config`, or global `form_schema`).
- **Manual publish only:** Step 5 (Review) surfaces readiness checklist and deep-links to Service Designer publish controls. No tool may invoke publish endpoints.
- **Starting point:** A catalogue service row must exist (adopt / fork / Masters create) before opening the assistant.

### 4. Entry scopes and portals

| Portal         | Route                                             | Scopes                                          |
| -------------- | ------------------------------------------------- | ----------------------------------------------- |
| `admin-tenant` | `/dashboard/services/[serviceId]/setup-assistant` | `full`, `form`, `workflow`, `payment`, `review` |
| `admin-state`  | `/dashboard/library/[code]/form/setup-assistant`  | `form` only                                     |

Scope determines visible wizard steps (see spec §3). State admin never receives workflow or payment tools.

**Scope entry UX:** Before the wizard opens, the operator selects scope via a **five-way picker** (`full` | `form` | `workflow` | `payment` | `review`). Tenant admin sees all five; state admin sees `form` only.

### 5. Workflow regenerate — replace vs merge

When a user opens workflow scope or Step 3, the assistant loads the current workflow draft as context. Mode follows **explicit user instruction**:

| User intent (examples)                                                      | Tool path                                                               | Effect                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| "Start over", "replace with scrutiny template", "use booking hall template" | `applyWorkflowTemplate` → `replaceWorkflowDraft` / `applyWorkflowDraft` | Full draft replacement after validation                    |
| "Add a clerk review stage", "remove payment step", "change SLA on EO stage" | `addWorkflowStage`, `mergeWorkflowDraft`, `setStageEffects`, etc.       | Incremental patch; existing stages retained unless removed |

The model infers mode from natural language. The admin may clarify in follow-up messages. The server never chooses replace when the user asked for an incremental edit.

### 6. Module layout (SSA-1 target)

```text
apps/api/src/modules/service-setup-assistant/
├── service-setup-assistant.module.ts
├── service-setup-assistant.controller.ts      # Tenant routes
├── state-form-assistant.controller.ts         # State form-only routes
├── service-setup-assistant.service.ts         # SSE orchestration (SSA-2+)
├── setup-session.service.ts
├── readiness-checklist.service.ts
├── tools/                                     # Per-step typed tools
└── prompts/                                   # Staff system prompts

packages/types/src/service-setup-assistant.ts  # Shared DTOs / SSE events
```

## Alternatives considered

| Option                                                    | Pros                     | Cons                                                                       | Rejected because                                                    |
| --------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Extend Sahayak module with admin mode flag                | Single LLM entry point   | Couples citizen RAG, guardrails, and session models; higher injection risk | Violates separation of staff vs citizen surfaces                    |
| Separate `SetupAssistantLlmService` duplicating providers | Hard isolation           | Duplicates ADR-0008 adapter wiring and DPA logic                           | Reuse `ChatbotLlmService` with separate prompts/tools is sufficient |
| Auto-publish when checklist is green                      | Faster go-live           | Bypasses admin review; breaks audit expectations                           | Explicitly rejected in spec §1.3                                    |
| JSON-only Service Designer (status quo)                   | No LLM OpEx              | High barrier for non-technical ULB admins                                  | Problem statement for SSA                                           |
| Dedicated `SETUP_ASSISTANT_LLM_PROVIDER` env in v1        | Independent model choice | Two provider configs to operate and monitor                                | Defer until pilot proves need                                       |

## Consequences

### Positive

- Staff configuration time should drop for pilot archetypes (`linear_approval`, `scrutiny`, `booking`).
- Validators (`validateFormSchema`, `validateWorkflowDefinition`) remain the single write gate — no parallel validation path.
- Sahayak LLM investment (adapter, keys, DPA workflow) is reused.

### Negative / costs

- Additional LLM OpEx per staff session (mitigated by optional token cap).
- Prompt injection risk in admin chat — requires adapted guardrails (SSA-6).
- Two admin AI surfaces to document and operate (Sahayak vs SSA).

### Neutral / follow-ups

- SSA-1: Prisma models + readiness API + wizard shell (no LLM).
- SSA-2: Form tools + SSE message endpoint.
- SSA-6: `tests/security/service-setup-assistant.spec.ts` + runbook.
- Optional: operator runbook RAG index (post-v1).

## Compliance / verification

| Check                        | When         | Command / artefact                                                      |
| ---------------------------- | ------------ | ----------------------------------------------------------------------- |
| Archetype seeds exist        | SSA-0        | `rg` on workflow template exports (see appendix)                        |
| No publish tools in registry | SSA-6        | `pnpm test:security -- service-setup-assistant.spec.ts`                 |
| Tenant isolation on sessions | SSA-1, SSA-6 | Unit + security tests                                                   |
| ADR followed in module       | SSA-1+       | Code review checklist: separate audit table, no RAG import from chatbot |
| Token cap honoured           | SSA-5        | Unit test on orchestration service                                      |

## Appendix A — Service archetype catalog (v1)

Archetypes are detected in Step 1 (`full` scope) and pre-select workflow template tools in Steps 3–4.

| Archetype          | Description                                          | Workflow seed function                                                 | Source file                                            | Typical payment           |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------- |
| `linear_approval`  | Submit → verify → approve → close                    | `createLinearWorkflowDraft(serviceCode, version?)`                     | `packages/workflow/src/index.ts`                       | Deferred or upfront       |
| `scrutiny`         | Multi-stage scrutiny (e.g. hoarding / advertisement) | `applyHoardingScrutinyTemplate(workflow)`                              | `apps/admin-tenant/lib/workflow-designer-templates.ts` | Multi-stage fees          |
| `certificate`      | Linear flow with certificate issuance effect         | `createLinearWorkflowDraft` + certificate stage effect in Step 3 tools | `packages/workflow/src/index.ts`                       | Upfront                   |
| `booking`          | Slot selection, hall booking pattern                 | `applyBookingHallTemplate(workflow, serviceCode)`                      | `apps/admin-tenant/lib/workflow-designer-templates.ts` | Upfront + bookable assets |
| `municipal_ladder` | Designation ladder (EO → CIC → VC → Chairperson)     | `applyMunicipalLadderTemplate(workflow)`                               | `apps/admin-tenant/lib/workflow-designer-templates.ts` | Designation-stage fees    |

**Usage pattern:** Tools call seed functions on a base draft (`createLinearWorkflowDraft(serviceCode)`), validate with `validateWorkflowDefinition`, then persist via existing `AdminTenantService` workflow-draft PATCH internals.

**Verification:** `apps/admin-tenant/lib/workflow-designer-templates.spec.ts` exercises hoarding, municipal ladder, and booking templates against `@enagar/workflow` validators.

## Appendix B — Sprint breakdown (EN-52)

| Sprint | Scope                                       | Exit                               |
| ------ | ------------------------------------------- | ---------------------------------- |
| SSA-0  | ADR + archetype catalog (this document)     | Spec signed off; boundaries locked |
| SSA-1  | Sessions, readiness checklist, wizard shell | Navigate steps; checklist accurate |
| SSA-2  | Form step + LLM (tenant + state)            | Form-only E2E with mocked LLM      |
| SSA-3  | Workflow step                               | Replace/merge regenerate works     |
| SSA-4  | Payment + review + full flow                | Pilot archetype end-to-end         |
| SSA-5  | Guardrails, security tests, runbook         | `pnpm test:security` green         |

## References

- [`docs/superpowers/specs/2026-06-22-service-setup-assistant-design.md`](../superpowers/specs/2026-06-22-service-setup-assistant-design.md)
- [`docs/superpowers/plans/2026-06-22-service-setup-assistant.md`](../superpowers/plans/2026-06-22-service-setup-assistant.md)
- [`docs/superpowers/plans/2026-06-22-ssa-0-en-52.md`](../superpowers/plans/2026-06-22-ssa-0-en-52.md)
- [`ADR-0008`](./ADR-0008-llm-provider-adapter.md) — LLM provider adapter
- [`ADR-0004`](./ADR-0004-workflow-engine.md) — Workflow engine
- `apps/api/src/modules/chatbot/chatbot-llm.service.ts` — DPA + provider resolution
- `apps/admin-tenant/lib/workflow-designer-templates.ts` — Template seeds
- `apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx` — Existing designer entry point
