# Service Setup Assistant — operator runbook

AI-guided wizard for tenant and state admins configuring services (form, workflow, payment, review). Staff-only; drafts auto-save; **publish is always manual** in Service Designer.

**ADR:** [`docs/ADRs/ADR-0016-service-setup-assistant.md`](../ADRs/ADR-0016-service-setup-assistant.md)  
**Programme plan:** [`docs/superpowers/plans/2026-06-22-service-setup-assistant.md`](../superpowers/plans/2026-06-22-service-setup-assistant.md)  
**Hardening (EN-57):** [`docs/superpowers/plans/2026-06-23-ssa-6-en-57.md`](../superpowers/plans/2026-06-23-ssa-6-en-57.md)

---

## URLs (local dev)

| Surface           | URL                                                                           |
| ----------------- | ----------------------------------------------------------------------------- |
| Tenant wizard     | `http://localhost:3002/dashboard/services/<serviceId>/setup-assistant`        |
| State form wizard | `http://localhost:3003/dashboard/library/<code>/form/setup-assistant`         |
| API (tenant)      | `POST /api/admin/tenant/services/:serviceId/setup-assistant/sessions`         |
| API (state)       | `POST /api/admin/state/global-service-library/:code/setup-assistant/sessions` |

---

## Environment variables

Set in `infrastructure/.env` (API reads via `load-infra-env`).

| Variable                                 | Purpose                                                        |
| ---------------------------------------- | -------------------------------------------------------------- |
| `LLM_PROVIDER`                           | Shared with Sahayak (`openai` \| `gemini` \| `ollama`)         |
| `SETUP_ASSISTANT_SKIP_DPA_DEV`           | `true` in local dev — skip tenant DPA gate for staff LLM calls |
| `SETUP_ASSISTANT_MAX_TOKENS`             | Per-turn LLM max tokens (default `2048`)                       |
| `SETUP_ASSISTANT_TEMPERATURE`            | LLM temperature (default `0.2`)                                |
| `SETUP_ASSISTANT_HISTORY_TURNS`          | Chat history window (default `6`)                              |
| `SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION` | Optional cumulative cap per session; unset = no hard stop      |

---

## Local bring-up

```bash
pnpm infra:up
pnpm db:seed
pnpm --filter @enagar/api prisma:migrate:deploy
# infrastructure/.env — ensure:
# SETUP_ASSISTANT_SKIP_DPA_DEV=true
pnpm --filter @enagar/api dev          # :3001
pnpm --filter @enagar/admin-tenant dev # :3002
```

Log in as a tenant admin (e.g. `kmc-tenant-admin-dummy` via Keycloak).

---

## Smoke verification

```bash
SMOKE_SETUP_ASSISTANT_BEARER=<jwt> \
SMOKE_SETUP_ASSISTANT_SERVICE_ID=<service-uuid> \
SMOKE_TENANT_CODE=KMC \
node scripts/smoke-service-setup-assistant.mjs

# Optional LLM SSE turn:
SMOKE_SETUP_ASSISTANT_CHAT=true ...
```

Expected: session created (form scope, step 2), checklist returned. With `CHAT=true`, SSE stream includes `event: meta` and `event: done` or `event: error` (if LLM offline).

---

## Security checks (CI)

```bash
pnpm test:security -- --runTestsByPath tests/security/service-setup-assistant.spec.ts
pnpm --filter @enagar/api test -- service-setup-assistant
```

Contract guarantees:

- No `publish*` tools in LLM registry
- Cross-tenant session access → 403
- State routes require `state_admin`
- Guardrails block injection / publish / cross-tenant / validator-bypass prompts

---

## Guardrails (operator)

Blocked user messages return HTTP 400 / SSE `error` before LLM call:

- Prompt injection patterns (shared with Sahayak)
- Requests to auto-publish form/workflow/service
- Cross-tenant data access
- Disabling validators

Allowed: normal draft edits, template application, readiness questions.

---

## Token budget

When `SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION` is set, cumulative input+output tokens are stored on `service_setup_sessions.token_usage_json`. Further messages in that session return:

> Session token budget exceeded. Start a new setup session to continue.

Start a new session from the wizard UI to reset.

---

## Audit trail

Every tool execution writes `service_setup_audit_logs` (tool name, step, success, input summary). LLM usage also flows to `chatbot_audit_logs` via `ChatbotLlmService`.

Query recent audit:

```sql
SELECT tool_name, step, success, created_at
FROM service_setup_audit_logs
WHERE tenant_id = '<tenant-uuid>'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Troubleshooting

| Symptom                      | Check                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| 401 on assistant API         | JWT expired — admin-tenant silent refresh (`/api/admin-auth/refresh`)                      |
| DPA / chatbot config error   | `SETUP_ASSISTANT_SKIP_DPA_DEV=true` in dev, or `tenants.config.chatbot.dpa_signed` in seed |
| LLM `event: error` in stream | `LLM_PROVIDER` + API keys; Ollama running if `ollama`                                      |
| Guardrail rejection          | Rephrase without publish/cross-tenant language                                             |
| Token budget exceeded        | New session or raise `SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION`                              |
| 403 on session               | Wrong tenant or another staff user's session                                               |

---

## Manual publish (required)

The assistant never publishes. After readiness is green:

1. Service Designer → **Form** tab → Publish form draft
2. **Workflow** tab → Publish workflow
3. **Config** tab → Save/publish config as per existing designer flow

Review step links deep-link to designer anchors (`#form`, `#workflow`, config).
