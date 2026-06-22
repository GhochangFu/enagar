# Service Setup Assistant — Design Specification

**Date:** 2026-06-22  
**Author:** Bappaditya Dasgupta  
**Status:** Approved (2026-06-22)  
**Related:** EN-52, Phase 7 Sahayak AI (ADR-0008), ADR-0016 (module boundaries), EN-4 Global Form Templates, Service Designer (Sprint 6.2–6.18)  
**Implementation plan:** [`docs/superpowers/plans/2026-06-22-service-setup-assistant.md`](../plans/2026-06-22-service-setup-assistant.md)  
**SSA-0 plan:** [`docs/superpowers/plans/2026-06-22-ssa-0-en-52.md`](../plans/2026-06-22-ssa-0-en-52.md)

---

## 1. Overview

The **Service Setup Assistant** is an AI-guided, step-based wizard embedded in admin portals. It helps non-technical operators configure an **existing catalogue service** from intent through form, workflow, payment/documents, and publish readiness — without requiring JSON editing.

The assistant combines:

- **Step wizard UX (Approach B)** — fixed progress, scoped steps, predictable flow
- **LLM tool-calling (Approach A)** — each step exposes typed tools that map to existing draft/publish APIs
- **Auto-save drafts (Autonomy B)** — successful tool calls persist immediately; admin publishes manually

### 1.1 Problem

Today, Tenant Admin must manually configure form schema, workflow definition, fee rules, document checklists, and revenue mapping across separate panels in the Service Designer. State Admin must separately curate global `form_schema` in the Service Library. This requires domain knowledge of workflow patterns, fee JSON, and designation stages — a barrier for ULB `tenant_admin` users.

### 1.2 Goals

| Goal                                   | Measure                                                |
| -------------------------------------- | ------------------------------------------------------ |
| Reduce time to first published service | Median setup time for pilot archetypes                 |
| No JSON required for happy path        | % sessions completing without opening JSON fallback    |
| Safe by default                        | Zero auto-publish; all writes pass existing validators |
| Reuse platform primitives              | Same APIs, validators, and LLM adapter as Sahayak      |

### 1.3 Non-goals (v1)

- AI creates new catalogue rows (service must exist via adopt/fork/Masters create first)
- Auto-publish form or workflow
- Grievance category / Operations configuration
- Replacing manual Service Designer panels (JSON fallback and direct edit remain)
- Citizen-facing chat (separate Sahayak module)

---

## 2. Decisions (confirmed)

| Topic               | Decision                                                                         |
| ------------------- | -------------------------------------------------------------------------------- |
| Starting point      | Service row must exist before opening assistant                                  |
| Autonomy            | Auto-save drafts per step; admin publishes manually                              |
| Primary users       | `tenant_admin` (full wizard); `state_admin` (Form step only)                     |
| State admin portal  | **`admin-state` only** — global form template library (`global-service-library`) |
| UX pattern          | Step wizard + per-step LLM tool registry                                         |
| Entry scopes        | Full setup, form-only, workflow-only, payment-only, review-only                  |
| Scope entry UX      | Five-way picker confirmed OK                                                     |
| Step 1 intent       | Archetype detection sufficient for v1 (no mandatory free-text gate)              |
| Workflow regenerate | **Replace or merge** — follows explicit user instruction in chat                 |
| Product name        | **Service Setup Assistant**                                                      |

---

## 3. User personas & portals

### 3.1 Tenant Admin (`apps/admin-tenant`)

**Route:** `/dashboard/services/[serviceId]/setup-assistant` (new; linked from Service Designer)

**Scopes available:**

| Scope      | Steps shown       | Use case                          |
| ---------- | ----------------- | --------------------------------- |
| `full`     | 1 → 2 → 3 → 4 → 5 | New ULB service setup end-to-end  |
| `form`     | 2 → 5             | Regenerate tenant form draft only |
| `workflow` | 3 → 5             | Regenerate workflow draft only    |
| `payment`  | 4 → 5             | Fee, documents, revenue only      |
| `review`   | 5                 | Check readiness before publish    |

**Backend target:** Existing tenant service designer APIs (`form-draft`, `workflow-draft`, `config`).

### 3.2 State Admin (`apps/admin-state`)

**Route:** `/dashboard/library/[code]/form/setup-assistant` (new; linked from Global Form Builder)

**Scope:** `form` only (Step 2 pattern)

**Backend target:** `PATCH /api/admin/state/global-service-library` (`form_schema` on `global_services` row)

State admin does **not** access tenant workflow or payment steps. ULBs adopt global forms via existing “Load State template” in Tenant Service Designer.

---

## 4. Wizard flow

```text
┌─────────────────────────────────────────────────────────────┐
│  Entry: pick scope (full | form | workflow | payment | review) │
└──────────────────────────┬──────────────────────────────────┘
                           │
     full only             ▼
                    ┌──────────────┐
                    │ Step 1       │  Intent & archetype (session only)
                    │ Intent       │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ Step 2     │   │ Step 3     │   │ Step 4     │
   │ Form       │   │ Workflow   │   │ Payment &  │
   │            │   │            │   │ documents  │
   └──────┬─────┘   └──────┬─────┘   └──────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                    ┌──────────────┐
                    │ Step 5       │  Readiness checklist + publish guide
                    │ Review       │  (no auto-publish)
                    └──────────────┘
```

### 4.1 Step 1 — Intent & archetype (tenant, `full` scope only)

**Purpose:** Classify the service and seed session context.

**LLM asks:** Service purpose, approval pattern, payment timing, certificate needs.

**Tools (read/write session only):**

| Tool                    | Action                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| `detectArchetype`       | Returns `linear_approval`, `scrutiny`, `booking`, `certificate`, etc. |
| `matchGlobalTemplate`   | Checks linked `global_form_template` / workflow_pattern on service    |
| `summarizeRequirements` | Writes structured brief to session for downstream steps               |

**No API persistence** in Step 1.

### 4.2 Step 2 — Form design

**Tenant tools → `PATCH .../form-draft`:**

| Tool                     | Action                                        |
| ------------------------ | --------------------------------------------- |
| `proposeFormFields`      | Add/update/remove fields with EN/BN labels    |
| `proposeCrossFieldRules` | Conditional validation rules                  |
| `loadGlobalTemplate`     | Copy state global template into draft         |
| `applyFormDraft`         | Validate via `validateFormSchema`, then PATCH |

**State tools → `PATCH .../global-service-library`:**

| Tool                    | Action                                               |
| ----------------------- | ---------------------------------------------------- |
| `proposeFormFields`     | Same field proposal logic                            |
| `applyGlobalFormSchema` | Validate, then PATCH `form_schema` on global service |

**UI:** Reuse `@enagar/forms/builder` preview pane; chat panel on the left.

### 4.3 Step 3 — Workflow design (tenant only)

**Tools → `PATCH .../workflow-draft`:**

| Tool                    | Action                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `applyWorkflowTemplate` | Seed from `workflow-designer-templates` (hoarding, municipal ladder, booking hall, PWD, etc.) |
| `addWorkflowStage`      | Add stage with designation / kind                                                             |
| `addWorkflowTransition` | Edge with verb, guards, effects                                                               |
| `setStageEffects`       | SLA, notify, certificate, payment link, etc.                                                  |
| `applyWorkflowDraft`    | Validate via `validateWorkflowDefinition`, then PATCH                                         |
| `replaceWorkflowDraft`  | Replace entire draft (e.g. new template seed) — user asked to “start over” / “replace”        |
| `mergeWorkflowDraft`    | Patch stages/transitions into existing draft — user asked to “add” / “change”                 |

**Regenerate workflow:** User selects `workflow` scope; Step 3 opens with current draft as context. LLM asks “What should change?” then:

- **Replace** when the user instructs a full redo (e.g. “replace with scrutiny template”, “start over”) → `replaceWorkflowDraft` or `applyWorkflowTemplate` + `applyWorkflowDraft`
- **Merge** when the user instructs incremental edits (e.g. “add a clerk review stage”, “remove payment step”) → `addWorkflowStage`, `mergeWorkflowDraft`, etc.

The assistant infers mode from user language; the admin can clarify in follow-up messages.

### 4.4 Step 4 — Payment & documents (tenant only)

**Tools → `PATCH .../config`:**

| Tool                    | Action                                                      |
| ----------------------- | ----------------------------------------------------------- |
| `listRevenueHeads`      | Read tenant Masters (context injection — no invented codes) |
| `proposeFeeRule`        | Fee JSON matching existing fee engine                       |
| `setPaymentSchedule`    | `upfront_only`, `deferred_only`, `upfront_and_deferred`     |
| `setRequiredDocuments`  | Document checklist                                          |
| `setGovernancePolicies` | BOC, municipal signoff policy/threshold                     |
| `applyServiceConfig`    | Validate + PATCH config                                     |

**Bookable assets:** If `workflow_pattern` is `booking`, optional sub-panel calls existing bookable asset mapping on `/config`.

### 4.5 Step 5 — Review & publish guide

**Read-only tools:**

| Tool                    | Action                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `getReadinessChecklist` | Form valid, workflow valid, config complete, drafts vs published |
| `explainBlockers`       | Human-readable reasons for amber/red items                       |
| `previewCitizenForm`    | Returns schema for `@enagar/forms/web` preview                   |

**Actions:** Links/buttons to existing **Publish Form**, **Publish Workflow** controls in Service Designer. Assistant does not invoke publish endpoints.

---

## 5. Architecture

### 5.1 Module layout

```text
apps/api/src/modules/service-setup-assistant/
├── service-setup-assistant.module.ts
├── service-setup-assistant.controller.ts      # Tenant routes
├── state-form-assistant.controller.ts         # State form-only routes
├── service-setup-assistant.service.ts         # Orchestration, SSE stream
├── setup-session.service.ts                   # CRUD + step state
├── readiness-checklist.service.ts             # Validation aggregation
├── tools/
│   ├── tenant-form.tools.ts
│   ├── tenant-workflow.tools.ts
│   ├── tenant-config.tools.ts
│   ├── state-global-form.tools.ts
│   └── tool-registry.ts                       # Step → allowed tools
├── prompts/
│   ├── system-tenant-full.md
│   ├── system-tenant-workflow-only.md
│   └── system-state-form.md
└── dto/

apps/admin-tenant/.../setup-assistant/         # Wizard shell + chat UI
apps/admin-state/.../form/setup-assistant/     # Form-only wizard shell

packages/types/src/service-setup-assistant.ts  # Session, scope, checklist types
```

### 5.2 Reuse from Sahayak (Phase 7)

| Component                            | Reuse                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ILLMProvider` / `ChatbotLlmService` | Shared adapter; same `LLM_PROVIDER` precedence as Sahayak (ADR-0016; dedicated `SETUP_ASSISTANT_LLM_PROVIDER` deferred post-pilot) |
| Guardrails                           | Adapt for admin context (block privilege escalation, cross-tenant injection)                                                       |
| SSE streaming                        | Same pattern as `POST /api/chatbot/query`                                                                                          |
| Audit                                | New table `service_setup_audit_logs` (parallel to `chatbot_audit_logs`)                                                            |

**Separate from citizen chatbot:**

- Different system prompts and tool registry
- No RAG over citizen KB (optional later: index operator runbooks)
- No citizen consent flow
- Session bound to `staff_subject_id` + tenant, not citizen

### 5.3 LLM interaction model

1. Client sends `POST /api/admin/tenant/services/:serviceId/setup-assistant/message` with `{ session_id, message }`.
2. Server loads session, resolves **allowed tools for current step**.
3. LLM receives system prompt + step context (current drafts, Masters data, archetype).
4. LLM may return text and/or **tool calls**.
5. Server executes tools server-side (never trust client-supplied JSON for writes).
6. Each mutating tool: validate → PATCH existing API internally → update session step completion.
7. SSE streams assistant text + `tool_result` events + `draft_updated` events.
8. Client refreshes preview panes on `draft_updated`.

### 5.4 Service archetypes (v1 seed set)

| Archetype          | Workflow template seed          | Typical payment     |
| ------------------ | ------------------------------- | ------------------- |
| `linear_approval`  | `createLinearWorkflowDraft`     | Deferred or upfront |
| `scrutiny`         | `applyHoardingScrutinyTemplate` | Multi-stage fees    |
| `certificate`      | Linear + certificate effect     | Upfront             |
| `booking`          | `applyBookingHallTemplate`      | Upfront + assets    |
| `municipal_ladder` | `applyMunicipalLadderTemplate`  | Designation stages  |

Archetype detected in Step 1 pre-selects template tools in Steps 3–4.

---

## 6. Data model

### 6.1 `service_setup_sessions`

```prisma
model ServiceSetupSession {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  serviceId       String?  @map("service_id")      // null for state form-only on global code
  globalServiceCode String? @map("global_service_code") // state admin only
  staffSubjectId  String   @map("staff_subject_id")
  scope           String   // full | form | workflow | payment | review
  currentStep     Int      @default(1) @map("current_step")
  archetype       String?
  requirementsJson Json?   @map("requirements_json")
  stepCompletion  Json     @default("{}") @map("step_completion")
  status          String   @default("active") // active | completed | abandoned
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  messages ServiceSetupMessage[]

  @@index([tenantId, serviceId])
  @@index([staffSubjectId])
  @@map("service_setup_sessions")
}
```

### 6.2 `service_setup_messages`

```prisma
model ServiceSetupMessage {
  id        String   @id @default(cuid())
  sessionId String   @map("session_id")
  role      String   // user | assistant | tool
  content   String
  toolCalls Json?    @map("tool_calls")
  createdAt DateTime @default(now()) @map("created_at")

  session ServiceSetupSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("service_setup_messages")
}
```

### 6.3 `service_setup_audit_logs`

```prisma
model ServiceSetupAuditLog {
  id              String   @id @default(cuid())
  sessionId       String   @map("session_id")
  tenantId        String   @map("tenant_id")
  staffSubjectId  String   @map("staff_subject_id")
  toolName        String   @map("tool_name")
  step            Int
  success         Boolean
  inputSummary    Json?    @map("input_summary")
  errorMessage    String?  @map("error_message")
  inputTokens     Int?     @map("input_tokens")
  outputTokens    Int?     @map("output_tokens")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([tenantId, createdAt])
  @@map("service_setup_audit_logs")
}
```

---

## 7. API surface

### 7.1 Tenant Admin

| Method  | Path                                                                            | Purpose                    |
| ------- | ------------------------------------------------------------------------------- | -------------------------- |
| `POST`  | `/admin/tenant/services/:serviceId/setup-assistant/sessions`                    | Create session `{ scope }` |
| `GET`   | `/admin/tenant/services/:serviceId/setup-assistant/sessions/:sessionId`         | Session + checklist        |
| `POST`  | `/admin/tenant/services/:serviceId/setup-assistant/sessions/:sessionId/message` | Chat (SSE)                 |
| `PATCH` | `/admin/tenant/services/:serviceId/setup-assistant/sessions/:sessionId/step`    | Manual step navigation     |
| `GET`   | `/admin/tenant/services/:serviceId/setup-assistant/readiness`                   | Checklist without session  |

**Auth:** Same as Service Designer — `tenant_admin`, `municipality_admin`, `state_admin` via `assertTenantPortalStaff`.

### 7.2 State Admin

| Method | Path                                                                                    | Purpose            |
| ------ | --------------------------------------------------------------------------------------- | ------------------ |
| `POST` | `/admin/state/global-service-library/:code/setup-assistant/sessions`                    | Form scope session |
| `POST` | `/admin/state/global-service-library/:code/setup-assistant/sessions/:sessionId/message` | Chat (SSE)         |

**Auth:** Existing state admin guards.

---

## 8. Readiness checklist

Returns per-layer status: `green` | `amber` | `red` + messages.

| Check                | Source                                                       |
| -------------------- | ------------------------------------------------------------ |
| Form draft valid     | `validateFormSchema(form_draft)`                             |
| Form published       | `form_published` exists                                      |
| Workflow draft valid | `validateWorkflowDefinition(workflow_draft)`                 |
| Workflow published   | `workflow_published` exists                                  |
| Config saved         | fee_rule + required_documents + revenue_head when fees apply |
| Booking assets       | Mapped when booking pattern detected                         |

Step 5 blocks “you're ready to publish” messaging until all **draft** layers are valid; publish itself remains explicit admin action.

---

## 9. Security & compliance

- **Tenant isolation:** Every tool execution verifies `session.tenantId` matches JWT tenant and `serviceId` belongs to tenant.
- **State isolation:** Global form tools verify `state_admin` role; no tenant workflow/config tools exposed.
- **Prompt injection:** Reuse Sahayak guardrails; reject requests to skip validation or call publish APIs.
- **Audit:** All tool calls logged with staff subject, tenant, step, success/failure.
- **PII:** Admin sessions may reference field labels/descriptions, not citizen application data.
- **Cost caps:** Per-session token budget (configurable); warn at 80%, hard stop at 100%.

---

## 10. UI specification

### 10.1 Layout (tenant wizard)

```text
┌────────────────────────────────────────────────────────────┐
│ PageHeader: Service name · Setup Assistant                  │
│ [Scope badge]  Step 2 of 5 — Form design                   │
│ ●──●──○──○──○  progress                                    │
├──────────────────────────┬─────────────────────────────────┤
│ Chat panel               │ Preview panel                    │
│ (user + assistant msgs)  │ Form builder / workflow canvas / │
│ Tool result chips        │ config summary / checklist       │
│ Input + Send             │                                  │
├──────────────────────────┴─────────────────────────────────┤
│ [Back step] [Skip to review] [Open full designer]           │
└────────────────────────────────────────────────────────────┘
```

- **Open full designer:** Deep link to existing Service Designer tab for manual override.
- **Skip to review:** Allowed when scope is partial and current step marked complete.

### 10.2 State admin form wizard

Same layout minus workflow/config preview; saves to global template with existing “Save form template” semantics surfaced as auto-save via tools.

---

## 11. Phase-wise implementation plan

### Phase 0 — Spec & ADR (1 sprint)

- [ ] This spec approved
- [ ] ADR: Service Setup Assistant module boundaries vs Sahayak
- [ ] Archetype catalog with template mapping
- [ ] Jira epic + sprint breakdown

**Exit:** Spec signed off.

### Phase 1 — Foundation (1 sprint)

- [ ] Prisma migration: sessions, messages, audit logs
- [ ] `readiness-checklist.service.ts` wired to existing designer load logic
- [ ] Tenant API: session CRUD + readiness GET
- [ ] Wizard shell UI (navigation, no LLM)
- [ ] Security: tenant isolation tests

**Exit:** Empty wizard navigates steps; checklist returns accurate status for any service.

### Phase 2 — Form step (1–2 sprints)

- [ ] Tenant form tools + auto-save via internal `admin-tenant.service` calls
- [ ] State global form tools + `admin-state` integration
- [ ] SSE message endpoint with mocked LLM integration test
- [ ] Form-only scope entry (tenant + state)
- [ ] UI: chat + form preview sync

**Exit:** Form-only path completes without JSON for one pilot service (tenant) and one global template (state).

### Phase 3 — Workflow step (1–2 sprints)

- [ ] Workflow tool registry + template seeds
- [ ] Workflow-only scope entry
- [ ] Canvas preview refresh on `draft_updated`
- [ ] Regenerate flow: replace **or** merge workflow draft per user instruction

**Exit:** Workflow-only and full-flow Step 3 work for `linear_approval` and `scrutiny` archetypes.

### Phase 4 — Payment & documents step (1 sprint)

- [ ] Config tools with Masters context injection
- [ ] Payment-only scope entry
- [ ] Fee preview surfaced in chat UI

**Exit:** Payment-only path saves valid config for a fee-bearing service.

### Phase 5 — Full flow & review (1 sprint)

- [ ] Step 1 intent/archetype (session-only tools)
- [ ] Full scope chains steps with skip for completed layers
- [ ] Step 5 checklist UI + publish guide links
- [ ] “Regenerate section” without clearing other drafts

**Exit:** End-to-end full setup for one pilot archetype; admin publishes manually.

### Phase 6 — Hardening & launch (1–2 sprints)

- [ ] LLM provider wiring (reuse `ChatbotLlmService` or thin wrapper)
- [ ] Guardrails + prompt injection security suite
- [ ] Rate limits + token budgets
- [ ] Operator runbook + smoke script
- [ ] Optional: Bengali question prompts

**Exit:** Production-ready with `pnpm test:security` coverage and smoke pass.

---

## 12. Testing strategy

| Layer     | Tests                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------ |
| Tools     | Unit: each tool validates before write; rejects cross-tenant serviceId                           |
| Checklist | Unit: green/amber/red for fixture services                                                       |
| API       | Integration: session lifecycle, SSE mock LLM                                                     |
| Security  | `tests/security/service-setup-assistant.spec.ts` — injection, tenant isolation, no publish tools |
| E2E smoke | Script: create session → one form tool call → verify draft persisted                             |

---

## 13. Open items (post-v1)

- RAG over operator runbooks / service catalogue docs
- Archetype picker at Masters “create service” time
- Thumbs feedback per step
- Analytics dashboard (drop-off by step)
- Auto-suggest global template when tenant adopts service

---

## 14. References

- `apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx`
- `apps/admin-state/app/dashboard/library/[code]/form/global-form-builder-client.tsx`
- `apps/admin-tenant/lib/workflow-designer-templates.ts`
- `docs/ADRs/ADR-0008-llm-provider-adapter.md`
- `docs/ADRs/ADR-0016-service-setup-assistant.md`
- `docs/backlog/EN-4-global-form-templates-onboarding.md`
- `docs/runbooks/master-sprint-73-plan.md` (Sahayak query pipeline)
