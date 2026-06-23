# SSA-5 follow-ups — Setup Assistant hardening (post UI test)

**Jira context:** EN-56 follow-ups from manual UI test report  
**Status:** Done

---

## Deliverables

| ID  | Deliverable                      | Files                                                                                                    |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| D1  | Workflow tool-call normalization | `packages/types/src/setup-assistant-tool-parser.ts`                                                      |
| D2  | Chat display JSON stripping      | Same + `setup-assistant-client.tsx`                                                                      |
| D3  | Silent Keycloak token refresh    | `admin-auth.ts`, `api/admin-auth/refresh/route.ts`, `auth/callback/route.ts`, `tenant-admin-session.tsx` |
| D4  | Tests + plan                     | `tool-call-parser.spec.ts`, `admin-auth.spec.ts`                                                         |

---

## Exit criteria

1. `replaceWorkflowDraft` / `applyWorkflowDraft` with `template_id` executes as `applyWorkflowTemplate`.
2. Truncated or bare `tool_calls` JSON is stripped from operator-visible chat text.
3. Setup Assistant API calls refresh access tokens within 90s of expiry without full logout.
4. Existing SSA API tests remain green; new parser + auth unit tests pass.

---

## Automated testing

```bash
pnpm --filter @enagar/types typecheck
pnpm --filter @enagar/api test -- tool-call-parser
pnpm --filter @enagar/api test -- service-setup-assistant
pnpm --filter @enagar/admin-tenant test -- admin-auth
```

---

## Manual UI tests (operator)

### F1 — Workflow template

1. Open Setup Assistant → **Workflow only** on any service.
2. Chat: `Apply linear_approval workflow template in replace mode`.
3. Expect: workflow preview populates; no raw `tool_calls` JSON in chat; step 3 shows ✓.

### F2 — Chat display

1. On intent step, send a message that previously showed ` ```json { "tool_calls": [] } `.
2. Expect: assistant reply has no fenced JSON visible.

### F3 — Token refresh

1. Sign in fresh (ensures `refresh_token` in sessionStorage).
2. Open Setup Assistant; wait until near token expiry OR temporarily lower `ACCESS_TOKEN_REFRESH_BUFFER_SEC` in dev.
3. Send a chat message after ~15+ minutes idle.
4. Expect: chat succeeds without 401; user is **not** logged out to Keycloak.

**Note:** Users who logged in before this change must sign out and sign in once to store `refresh_token`.

---

## Code review gates

- [x] Normalization is server-side (parser) before tool execution
- [x] Client strips display-only markup; does not parse tools
- [x] Refresh route uses server-side Keycloak token endpoint only
- [x] No refresh_token logged or exposed in UI
