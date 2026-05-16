# Master Sprint 6.12 Plan — Phase 6 P5 Identity, Library, Integrations, and Hardening

Status: **executed — engineering and manual smoke closed 2026-05-16**.

## Scope

Deliver the four **P5** rows from `docs/backlog/phase-6-vision-backlog-prioritized.md` as a bounded Phase 6 hardening sprint:

- Staff invite and Keycloak user provisioning UX for tenant operators.
- State Global Service Library curator for template authoring and controlled publication.
- State integration cockpit for external-provider readiness and configuration status.
- Phase 6 exit-hardening subset: admin mutation audit coverage and wizard-only onboarding guardrails.

P5 is heavier than P1-P4 because it touches identity operations, state-wide templates, procurement-gated integrations, and acceptance hardening. Keep Sprint 6.12 shippable by implementing **control-plane contracts and safe local stubs**, not live external integrations or production identity automation.

## Key Existing Surfaces

- Tenant staff role assignment already exists in `apps/admin-tenant/app/dashboard/operations/operations-client.tsx` and `apps/api/src/modules/admin-tenant/admin-tenant.service.ts`, but today it upserts by known Keycloak subject ID.
- Keycloak local realm and dummy operator guidance live in `docs/runbooks/keycloak.md`, `infrastructure/keycloak/realm-export.json`, and the seed scripts.
- State Admin already owns tenant onboarding, impersonation, audit search/export, tenant drill-down, analytics, and transparency in `apps/admin-state` and `apps/api/src/modules/admin-state`.
- Catalogue governance in Sprint 6.10 introduced tenant adopt/fork/deactivate flows, but state-wide global template authoring remains absent.
- Integration-like domains already exist as platform primitives: PSP/payment stubs, notification templates, DigiLocker deferral docs, storage metadata, audit logs, and config JSON.
- Audit coverage is partial: some state actions write `state_audit_logs`, while not every tenant/admin mutation has an explicit audit contract.

## Sub-Sprints

### 6.12A — Tenant Staff Invite And Keycloak Provisioning UX

Deliverables:

- Replace subject-ID-first staff creation with a guided invite/provisioning flow for tenant staff:
  - username/email/mobile input.
  - role codes and optional ward assignment.
  - invite status (`draft`, `pending_keycloak`, `provisioned`, `failed`, `disabled`) or equivalent.
  - generated invite metadata without exposing secrets.
- Add an API boundary that can:
  - run against local Keycloak admin credentials when configured.
  - fall back to a safe `dry_run`/queued provisioning record when credentials are absent.
- Preserve current upsert-by-subject-ID as an admin fallback until the new flow is verified.
- Add tenant-scoped audit entries for invite creation, resend/retry, disable, and role changes.
- Surface clear operator errors for missing Keycloak configuration, duplicate username/email, MFA-required roles, and tenant mismatch.

Non-goals:

- No production Keycloak realm migration without DevOps/security sign-off.
- No password display or secret persistence in application tables.
- No MFA enrollment automation.
- No cross-tenant user movement.
- No HRMS or SSO directory integration.

### 6.12B — State Global Service Library Curator

Deliverables:

- Add State Admin APIs and UI for global service template authoring:
  - category, code, localized name/description.
  - default SLA, fee config, document checklist, form/workflow template references where practical.
  - lifecycle states such as draft, published, deprecated.
- Add validation that prevents breaking tenant overrides or tenant-only services.
- Add preview/diff support showing what tenants would inherit before publishing.
- Add publish/deprecate actions with state audit events.
- Connect published templates to existing tenant catalogue governance so tenant admins can adopt/fork/deactivate consistently.

Non-goals:

- No automatic migration of every tenant to new template versions.
- No destructive edits of already adopted tenant services.
- No full marketplace/search product.
- No service catalogue legal/by-law approval workflow beyond local status metadata.

### 6.12C — State Integration Cockpit

Deliverables:

- Add a State Admin integration cockpit for provider readiness and configuration status:
  - DigiLocker.
  - PSP/payment gateway.
  - SMS DLT/provider.
  - email/WhatsApp notification provider placeholders.
  - object storage and RAG/indexer health indicators where safe.
- Store only non-secret metadata in the app database: provider key, environment, status, last health check, owner, notes, and required-doc checklist.
- Add readiness checks that call existing local health/stub endpoints where available and otherwise show `not_configured` or `manual_check_required`.
- Add CSV/export or copyable summary for sponsor/DevOps review.
- Add state audit events for configuration status changes.

Non-goals:

- No live DigiLocker/PSP/SMS credential entry in this sprint.
- No webhook endpoint production certification.
- No secret manager implementation.
- No outbound SMS/email/WhatsApp send pipeline.
- No procurement workflow replacement.

### 6.12D — Audit Coverage And Wizard-Only Onboarding Hardening

Deliverables:

- Define and implement a measurable audit coverage matrix for Phase 6 admin mutations:
  - tenant settings/branding/feature flags.
  - service config, catalogue governance, forms/workflows.
  - masters/imports, banners/templates/KB/RAG triggers.
  - staff/invites/role maps.
  - state tenant onboarding, library, integration cockpit, impersonation.
- Add common audit helper(s) where they reduce duplication and match existing service patterns.
- Add "wizard-only onboarding" guardrails for tenant creation/update:
  - required fields and validation summary.
  - draft/complete status or equivalent.
  - no bypass of required onboarding fields through generic patch paths.
- Add docs for what remains out of scope for full sponsor acceptance.

Non-goals:

- No SIEM pipeline.
- No immutable ledger or WORM storage.
- No universal audit retrofit for every historical non-admin domain mutation.
- No production support process sign-off automation.

### 6.12E — Docs, Tests, Verification

Deliverables:

- Add `docs/runbooks/master-sprint-612-exit.md` during execution.
- Update P5 rows in `docs/backlog/phase-6-vision-backlog-prioritized.md` from "planned" to "closed engineering" only after implementation and verification.
- Update `README.md`, `ROADMAP.md`, `apps/admin-tenant/README.md`, `apps/admin-state/README.md`, `docs/help/start-the-app-step-by-step.md`, and `tests/security/README.md`.
- Add `tests/security/master-sprint-612.spec.ts` covering:
  - staff invite/provisioning is tenant-scoped and does not persist generated secrets.
  - global service library publish/deprecate does not mutate tenant overrides destructively.
  - integration cockpit stores metadata only, not provider secrets.
  - admin mutation audit coverage includes the sprint's new endpoints.
  - tenant onboarding cannot bypass required wizard guardrails.
- Add focused API/UI tests where existing service specs make this practical.

## Exit Criteria

- Tenant Admin can create and manage staff invites through guided controls, with safe fallback when Keycloak admin credentials are unavailable.
- Staff invite/provisioning actions are tenant-scoped, audited, and do not expose or persist secrets.
- State Admin can draft, preview, publish, and deprecate global service library templates without breaking tenant overrides.
- State Admin can view/update integration readiness metadata and run safe local/stub readiness checks.
- Admin mutation audit coverage is documented and enforced for the Sprint 6.12 scope.
- Tenant onboarding uses wizard guardrails for required fields and cannot be bypassed through generic patch paths.
- Existing Sprint 6.8-6.11 operations, reporting, catalogue, transparency, branding, and bookings contracts remain valid.

## Verification Plan

Run, at minimum, after implementation:

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test -- admin-tenant.service.spec.ts admin-state.service.spec.ts
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/admin-state typecheck
pnpm --filter @enagar/admin-state lint
pnpm --filter @enagar/admin-state build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-612.spec.ts tests/security/master-sprint-611.spec.ts tests/security/master-sprint-610.spec.ts
pnpm test:security
graphify update .
```

Add package-specific checks if Keycloak admin client code, secret handling, or integration health clients introduce new package boundaries.

## Manual Smoke After Completion

1. Start infra, migrate, seed, API, Tenant Admin, State Admin, Citizen PWA, and local Keycloak.
2. Sign into Tenant Admin as a KMC/HMC municipality admin.
3. Create a staff invite in dry-run mode, then with local Keycloak provisioning if configured; confirm role/ward display and audit entry.
4. Try duplicate username/email and cross-tenant role assignment; confirm safe validation errors.
5. Sign into State Admin as a state admin.
6. Draft a global service template, preview tenant impact, publish it, and confirm Tenant Admin catalogue governance can see/adopt/fork it.
7. Update integration cockpit metadata for DigiLocker/PSP/SMS; confirm no secret values are accepted or persisted.
8. Run onboarding wizard validation; confirm incomplete required fields block completion.
9. Search/export audit logs for the new staff, library, integration, and onboarding actions.
10. Re-run Sprint 6.11 smoke checks for PDF, KB/RAG, branding assets, and bookings to confirm no regressions.

## Decision Defaults

- Sprint name: `Master Sprint 6.12 — Phase 6 P5 Identity, Library, Integrations, and Hardening`.
- Keep all four P5 rows together only if implementation remains bounded to control-plane MVPs; split live Keycloak provisioning or integration clients into follow-up sprints if credentials/security review expands scope.
- Prefer local/dry-run provisioning contracts over unreviewed production identity writes.
- Prefer metadata-only integration cockpit records over storing secrets.
- Prefer explicit audit coverage matrices over vague "audit everything" claims.
- Do not advance Phase 7 RAG/LLM quality work or Sprint 3.1B PSP production work inside this sprint unless separately confirmed.
