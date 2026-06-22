# Service Setup Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an AI-guided step wizard that helps `tenant_admin` configure existing services (form, workflow, payment, review) and `state_admin` curate global form templates — auto-saving drafts via typed LLM tools, with manual publish only.

**Architecture:** New NestJS module `service-setup-assistant` reuses `ChatbotLlmService` / `ILLMProvider` for streaming, exposes per-step tool registries that call existing `AdminTenantService` / `AdminStateService` internals, and persists wizard state in `service_setup_sessions`. Admin UIs are thin wizard shells in `admin-tenant` and `admin-state`.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js 14 App Router, `@enagar/forms`, `@enagar/workflow`, existing SSE pattern from `chatbot.service.ts`, `pnpm test:security`.

**Spec:** [`docs/superpowers/specs/2026-06-22-service-setup-assistant-design.md`](../specs/2026-06-22-service-setup-assistant-design.md)

---

## File map (created / modified)

| File                                                                     | Responsibility                          |
| ------------------------------------------------------------------------ | --------------------------------------- |
| `packages/types/src/service-setup-assistant.ts`                          | Scope, step, checklist, SSE event types |
| `packages/types/src/index.ts`                                            | Re-export                               |
| `apps/api/prisma/schema.prisma`                                          | 3 new models                            |
| `apps/api/src/modules/service-setup-assistant/*`                         | Core module                             |
| `apps/api/src/app.module.ts`                                             | Register module                         |
| `apps/admin-tenant/app/dashboard/services/[serviceId]/setup-assistant/*` | Tenant wizard UI                        |
| `apps/admin-state/app/dashboard/library/[code]/form/setup-assistant/*`   | State form wizard UI                    |
| `tests/security/service-setup-assistant.spec.ts`                         | Contract tests                          |
| `scripts/smoke-service-setup-assistant.mjs`                              | Smoke                                   |
| `docs/ADRs/ADR-0016-service-setup-assistant.md`                          | Module boundary ADR                     |
| `docs/runbooks/service-setup-assistant.md`                               | Operator runbook                        |

---

## Phase 0 — ADR & archetype catalog (no product code)

### Task 0.1: Write ADR

**Files:**

- Create: `docs/ADRs/ADR-0016-service-setup-assistant.md`

- [ ] **Step 1:** Document boundaries vs Sahayak citizen chatbot (no RAG v1, no auto-publish, staff audit).
- [ ] **Step 2:** Document LLM env reuse (`LLM_PROVIDER`, optional `SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION`).
- [ ] **Step 3:** Document workflow replace-vs-merge behaviour (user-instruction driven).

**Exit:** ADR merged; archetype → template mapping table in ADR appendix:

| Archetype          | Workflow seed function          | File                                                   |
| ------------------ | ------------------------------- | ------------------------------------------------------ |
| `linear_approval`  | `createLinearWorkflowDraft`     | `packages/workflow/src/index.ts`                       |
| `scrutiny`         | `applyHoardingScrutinyTemplate` | `apps/admin-tenant/lib/workflow-designer-templates.ts` |
| `booking`          | `applyBookingHallTemplate`      | same                                                   |
| `municipal_ladder` | `applyMunicipalLadderTemplate`  | same                                                   |

---

## Phase 1 — Foundation (readiness + sessions + wizard shell)

### Task 1.1: Shared types

**Files:**

- Create: `packages/types/src/service-setup-assistant.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add types**

```typescript
// packages/types/src/service-setup-assistant.ts
export type SetupAssistantScope = 'full' | 'form' | 'workflow' | 'payment' | 'review';

export type SetupAssistantStep = 1 | 2 | 3 | 4 | 5;

export type ChecklistStatus = 'green' | 'amber' | 'red';

export type SetupReadinessItem = {
  key: string;
  label: string;
  status: ChecklistStatus;
  message?: string;
};

export type SetupReadinessChecklist = {
  items: SetupReadinessItem[];
  ready_to_publish: boolean;
};

export type SetupSessionDto = {
  id: string;
  scope: SetupAssistantScope;
  current_step: SetupAssistantStep;
  archetype: string | null;
  step_completion: Record<string, boolean>;
  status: 'active' | 'completed' | 'abandoned';
};

export type SetupAssistantSseEvent =
  | { type: 'meta'; session_id: string; step: number }
  | { type: 'token'; delta: string }
  | { type: 'tool_result'; name: string; success: boolean; summary: string }
  | { type: 'draft_updated'; layer: 'form' | 'workflow' | 'config' }
  | { type: 'done' }
  | { type: 'error'; message: string };
```

- [ ] **Step 2: Export from index**

```typescript
export * from './service-setup-assistant';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @enagar/types typecheck
```

Expected: PASS

---

### Task 1.2: Prisma models

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via `prisma migrate dev`

- [ ] **Step 1:** Add models from spec §6 (`ServiceSetupSession`, `ServiceSetupMessage`, `ServiceSetupAuditLog`) using project conventions (`@map`, `@@map`, `@default(cuid())`).

- [ ] **Step 2: Run migration**

```bash
cd apps/api
pnpm prisma migrate dev --name service_setup_assistant_sessions
pnpm prisma generate
```

Expected: migration applies cleanly

---

### Task 1.3: Readiness checklist service

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/readiness-checklist.service.ts`
- Create: `apps/api/src/modules/service-setup-assistant/readiness-checklist.service.spec.ts`
- Modify: `apps/api/src/modules/admin-tenant/admin-tenant.service.ts` (extract shared loader if needed, or inject existing `getServiceDesigner` logic)

- [ ] **Step 1: Write failing test**

```typescript
// readiness-checklist.service.spec.ts
import { ReadinessChecklistService } from './readiness-checklist.service';

describe('ReadinessChecklistService', () => {
  it('returns red when form draft missing or invalid', async () => {
    const svc = new ReadinessChecklistService(mockPrisma, mockAdminTenant);
    const result = await svc.forService('tenant-1', 'service-1');
    const formItem = result.items.find((i) => i.key === 'form_draft_valid');
    expect(formItem?.status).toBe('red');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @enagar/api test -- readiness-checklist.service.spec
```

- [ ] **Step 3: Implement `forService(tenantId, serviceId)`**

Checks (map to spec §8):

- `form_draft_valid` — `validateFormSchema`
- `form_published`
- `workflow_draft_valid` — `validateWorkflowDefinition`
- `workflow_published`
- `config_complete` — fee_rule, documents, revenue_head when applicable
- `booking_assets` — when `workflow_pattern === 'booking'`

Set `ready_to_publish` only when all draft layers valid **and** published versions exist for form + workflow.

- [ ] **Step 4: Run test — expect PASS**

---

### Task 1.4: Setup session service

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/setup-session.service.ts`
- Create: `apps/api/src/modules/service-setup-assistant/setup-session.service.spec.ts`

- [ ] **Step 1: Implement `createSession({ tenantId, serviceId, staffSubjectId, scope })`**

Scope → initial step mapping:

- `full` → step 1
- `form` → step 2
- `workflow` → step 3
- `payment` → step 4
- `review` → step 5

- [ ] **Step 2: Implement `assertSessionAccess(sessionId, tenantId, staffSubjectId)`** — reject cross-tenant.

- [ ] **Step 3: Unit test tenant isolation**

---

### Task 1.5: Tenant API routes (no LLM yet)

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/service-setup-assistant.controller.ts`
- Create: `apps/api/src/modules/service-setup-assistant/service-setup-assistant.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Register routes**

| Method  | Path                                                                        |
| ------- | --------------------------------------------------------------------------- |
| `POST`  | `admin/tenant/services/:serviceId/setup-assistant/sessions`                 |
| `GET`   | `admin/tenant/services/:serviceId/setup-assistant/sessions/:sessionId`      |
| `GET`   | `admin/tenant/services/:serviceId/setup-assistant/readiness`                |
| `PATCH` | `admin/tenant/services/:serviceId/setup-assistant/sessions/:sessionId/step` |

Use `assertTenantPortalStaff` from `tenant-admin-portal-roles.ts`.

- [ ] **Step 2: Wire module imports `AdminTenantModule` (or service) for designer data**

- [ ] **Step 3: API unit test — create session returns 201 with correct `current_step` per scope**

---

### Task 1.6: Tenant wizard shell UI

**Files:**

- Create: `apps/admin-tenant/app/dashboard/services/[serviceId]/setup-assistant/page.tsx`
- Create: `apps/admin-tenant/app/dashboard/services/[serviceId]/setup-assistant/setup-assistant-client.tsx`
- Modify: `apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx` (link: "Open Setup Assistant")

- [ ] **Step 1: Scope picker UI** — five cards: Full / Form / Workflow / Payment / Review

- [ ] **Step 2: On select → `POST .../sessions` → navigate with `sessionId` query**

- [ ] **Step 3: Progress bar** — steps shown per scope (hide 1 for non-full)

- [ ] **Step 4: Placeholder chat panel + readiness sidebar calling `GET .../readiness`**

- [ ] **Step 5: Manual step navigation via `PATCH .../step`**

**Exit Phase 1:** Wizard navigates; checklist displays real status; no LLM.

---

## Phase 2 — Form step (tenant + state)

### Task 2.1: Tool registry foundation

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/tools/tool-registry.ts`
- Create: `apps/api/src/modules/service-setup-assistant/tools/tool.types.ts`

- [ ] **Step 1: Define `SetupToolContext`** — `{ session, tenantId, serviceId?, globalServiceCode?, step }`

- [ ] **Step 2: Define `SetupToolDefinition`** — `{ name, description, parameters: zodSchema, execute(ctx, args) }`

- [ ] **Step 3: `getToolsForStep(scope, step)`** — returns allowed tool names only

---

### Task 2.2: Tenant form tools

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/tools/tenant-form.tools.ts`
- Create: `apps/api/src/modules/service-setup-assistant/tools/tenant-form.tools.spec.ts`

- [ ] **Step 1: `applyFormDraft`** — load current draft, merge proposed schema, `validateFormSchema`, call same logic as `AdminTenantService.patchFormDraft`

- [ ] **Step 2: `loadGlobalTemplate`** — reuse designer's global template resolution

- [ ] **Step 3: `proposeFormFields`** — returns merged schema in memory; does not persist until `applyFormDraft`

- [ ] **Step 4: Tests** — invalid schema rejected; valid schema persists; wrong `service_code` rejected

---

### Task 2.3: State global form tools

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/tools/state-global-form.tools.ts`
- Create: `apps/api/src/modules/service-setup-assistant/state-form-assistant.controller.ts`

- [ ] **Step 1: `applyGlobalFormSchema`** — validate + `AdminStateService` patch `form_schema`

- [ ] **Step 2: Routes under `admin/state/global-service-library/:code/setup-assistant/*`**

- [ ] **Step 3: State admin auth guards** — existing state admin decorator/guard

---

### Task 2.4: LLM orchestration (form step only)

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/service-setup-assistant.service.ts`
- Create: `apps/api/src/modules/service-setup-assistant/prompts/system-tenant-form.md`
- Create: `apps/api/src/modules/service-setup-assistant/prompts/system-state-form.md`
- Modify: `apps/api/src/modules/service-setup-assistant/service-setup-assistant.controller.ts`

- [ ] **Step 1: `POST .../message` SSE endpoint** — mirror `chatbot.service.ts` event shape using `SetupAssistantSseEvent`

- [ ] **Step 2: Inject `ChatbotLlmService`** — reuse provider resolution; skip DPA check for staff-only module OR require same `dpa_signed` (decide in ADR; default: reuse with `SETUP_ASSISTANT_SKIP_DPA_DEV`)

- [ ] **Step 3: Tool-call loop** — parse JSON tool calls from model response (start with structured JSON mode, not OpenAI native tools, to match existing patterns)

- [ ] **Step 4: On successful mutating tool → emit `draft_updated`**

- [ ] **Step 5: Persist messages to `service_setup_messages` + audit to `service_setup_audit_logs`**

- [ ] **Step 6: Integration test with mocked `ILLMProvider` returning `applyFormDraft` call**

---

### Task 2.5: Form step UI wiring

**Files:**

- Modify: `setup-assistant-client.tsx`
- Create: `apps/admin-state/app/dashboard/library/[code]/form/setup-assistant/page.tsx`
- Create: `apps/admin-state/app/dashboard/library/[code]/form/setup-assistant/state-form-assistant-client.tsx`
- Modify: `global-form-builder-client.tsx` (link to assistant)

- [ ] **Step 1: SSE client** — reuse pattern from `apps/citizen-pwa/lib/chatbot-api.ts` adapted for admin bearer token

- [ ] **Step 2: Form preview** — embed `FormCitizenPreview` / `FormSchemaBuilder` read-only; refresh on `draft_updated`

- [ ] \*\*Step 3: Mark step 2 complete in session when `form_draft_valid` is green

**Exit Phase 2:** Form-only scope works E2E for tenant + state with mocked LLM in CI; manual test with real LLM locally.

---

## Phase 3 — Workflow step

### Task 3.1: Workflow tools (replace + merge)

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/tools/tenant-workflow.tools.ts`
- Create: `apps/api/src/modules/service-setup-assistant/tools/tenant-workflow.tools.spec.ts`
- Create: `apps/api/src/modules/service-setup-assistant/prompts/system-tenant-workflow.md`

- [ ] **Step 1: `replaceWorkflowDraft(definition)`** — full replacement after `validateWorkflowDefinition`

- [ ] **Step 2: `mergeWorkflowDraft(patch)`** — merge stages by `code`, add/remove transitions; revalidate

- [ ] **Step 3: `applyWorkflowTemplate(templateId)`** — call existing template functions from `workflow-designer-templates.ts` (import via shared package or duplicate thin wrapper in API)

- [ ] **Step 4: Prompt instructs model** — use `replaceWorkflowDraft` when user says "replace/start over/new template"; use `mergeWorkflowDraft` / `addWorkflowStage` for incremental edits

- [ ] **Step 5: Tests**

```typescript
it('mergeWorkflowDraft adds a stage without removing existing', async () => { ... });
it('replaceWorkflowDraft replaces all stages', async () => { ... });
```

---

### Task 3.2: Workflow step UI

**Files:**

- Modify: `setup-assistant-client.tsx`

- [ ] **Step 1: Workflow-only scope entry** (already in scope picker)

- [ ] **Step 2: Read-only workflow summary panel** — stage list + transition count (full xyflow optional v1.1)

- [ ] **Step 3: Refresh on `draft_updated` layer `workflow`**

**Exit Phase 3:** Workflow-only regenerate works for `linear_approval` and `scrutiny` archetypes.

---

## Phase 4 — Payment & documents step

### Task 4.1: Config tools with Masters context

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/tools/tenant-config.tools.ts`
- Create: `apps/api/src/modules/service-setup-assistant/tools/tenant-config.tools.spec.ts`

- [ ] **Step 1: `listRevenueHeads`** — read-only from tenant masters API/service

- [ ] **Step 2: `applyServiceConfig`** — validate fee JSON + documents + policies; PATCH config

- [ ] **Step 3: Reject unknown `revenue_head_code`** not in tenant list

- [ ] **Step 4: `listRevenueHeads` injected into LLM system context** before each Step 4 message

---

### Task 4.2: Payment step UI

- [ ] **Step 1: Config summary panel** — fee preview paise, document count, revenue head code

- [ ] \*\*Step 2: Payment-only scope E2E

**Exit Phase 4:** Payment-only path saves valid config.

---

## Phase 5 — Full flow + review step

### Task 5.1: Intent step tools (session only)

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/tools/intent.tools.ts`
- Create: `apps/api/src/modules/service-setup-assistant/prompts/system-tenant-full.md`

- [ ] **Step 1: `detectArchetype`** — keyword/heuristic + optional LLM classification

- [ ] **Step 2: `matchGlobalTemplate`** — read designer payload fields

- [ ] **Step 3: `summarizeRequirements`** — JSON blob on session

- [ ] \*\*Step 4: No PATCH to form/workflow/config in step 1

---

### Task 5.2: Review step

**Files:**

- Modify: `readiness-checklist.service.ts`
- Create: `apps/api/src/modules/service-setup-assistant/tools/review.tools.ts`

- [ ] **Step 1: `getReadinessChecklist` tool** — wraps checklist service

- [ ] **Step 2: `explainBlockers` tool** — templated human messages

- [ ] **Step 3: Review UI** — checklist with links to Service Designer publish actions (`/dashboard/services/[id]#form`, etc.)

- [ ] \*\*Step 4: Full scope chains steps 1→5; skip completed steps optional

**Exit Phase 5:** Full setup for one pilot service (e.g. birth certificate linear flow).

---

## Phase 6 — Hardening & launch

### Task 6.1: Guardrails

**Files:**

- Create: `apps/api/src/modules/service-setup-assistant/guardrails.ts`
- Create: `apps/api/src/modules/service-setup-assistant/guardrails.spec.ts`

- [ ] **Step 1: Block messages** requesting publish, cross-tenant access, or disabling validation

- [ ] \*\*Step 2: Reuse patterns from `chatbot/guardrails.ts`

---

### Task 6.2: Security contract tests

**Files:**

- Create: `tests/security/service-setup-assistant.spec.ts`

- [ ] **Step 1: Tenant A cannot access Tenant B session**

- [ ] **Step 2: Tool registry does not expose publish endpoints**

- [ ] **Step 3: State routes reject `tenant_admin` token without state role**

```bash
pnpm test:security -- --runTestsByPath tests/security/service-setup-assistant.spec.ts
```

---

### Task 6.3: Smoke script & runbook

**Files:**

- Create: `scripts/smoke-service-setup-assistant.mjs`
- Create: `docs/runbooks/service-setup-assistant.md`
- Modify: `infrastructure/.env.example`

- [ ] **Step 1: Smoke** — create session (form scope) → mock or live one message → verify form draft version incremented

- [ ] \*\*Step 2: Document env vars and operator flow

- [ ] \*\*Step 3: `graphify update .` after code lands

---

### Task 6.4: Token budget (optional but recommended)

- [ ] \*\*Step 1: Track cumulative tokens on session row (`token_usage_json`)

- [ ] \*\*Step 2: Hard stop when `SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION` exceeded

**Exit Phase 6:** CI green; runbook published; sponsor demo ready.

---

## Verification (full programme)

```bash
pnpm infra:up
pnpm db:seed
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-state typecheck
pnpm test:security -- --runTestsByPath tests/security/service-setup-assistant.spec.ts
node scripts/smoke-service-setup-assistant.mjs
```

---

## Suggested sprint mapping

| Sprint    | Jira  | Phases                               | Duration  |
| --------- | ----- | ------------------------------------ | --------- |
| **SSA-0** | EN-52 | Phase 0 — ADR & archetype catalog    | 3–5 days  |
| SSA-1     | EN-52 | Phase 1 — Foundation                 | 2 weeks   |
| SSA-2     | EN-52 | Phase 2 — Form step                  | 2 weeks   |
| SSA-3     | EN-52 | Phase 3 — Workflow step              | 2 weeks   |
| SSA-4     | EN-52 | Phase 4 + Phase 5 — Payment & review | 2 weeks   |
| SSA-5     | EN-52 | Phase 6 — Hardening & launch         | 1–2 weeks |

**SSA-0 detail:** [`docs/superpowers/plans/2026-06-22-ssa-0-en-52.md`](2026-06-22-ssa-0-en-52.md)

**Total:** ~9–10 weeks sequential; Phase 2 state form track can parallel Phase 3 prep.

---

## Spec coverage self-review

| Spec section    | Plan task                           |
| --------------- | ----------------------------------- |
| §2 Decisions    | Phase 0 ADR; Task 3.1 replace/merge |
| §3 Personas     | Tasks 1.6, 2.3, 2.5                 |
| §4 Wizard steps | Tasks 2.x–5.x per step              |
| §5 Architecture | File map + Task 2.1                 |
| §6 Data model   | Task 1.2                            |
| §7 API          | Tasks 1.5, 2.3, 2.4                 |
| §8 Checklist    | Task 1.3, 5.2                       |
| §9 Security     | Tasks 6.1–6.2                       |
| §10 UI          | Tasks 1.6, 2.5, 3.2, 4.2, 5.2       |
| §11 Phases      | Sprint mapping                      |
| §12 Testing     | Throughout + Task 6.2               |

No open gaps.
