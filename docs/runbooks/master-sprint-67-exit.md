# Master Sprint 6.7 Exit — Designer Polish

Status: **closed engineering** pending human acceptance smoke.

## Deliverables

- Tenant Admin service designer now has a drag/drop **Visual form builder** on top of the existing `service_form_versions` draft/publish API.
- The form palette can add sections, text, textarea, number, date, single choice, dropdown, multi-select, and file-upload fields without hand-authoring JSON.
- A field inspector edits stable field IDs, multilingual labels, help text, required state, choice options, accepted MIME types, and upload size limits.
- Tenant Admin service designer now has a **React Flow** workflow canvas backed by `@xyflow/react`.
- The workflow canvas renders stages and transitions from the same `WorkflowDefinition` JSON already persisted into `workflows`, `workflow_stages`, and `workflow_transitions`.
- Stage and transition inspectors can add/remove stages, edit owner roles, SLA hours, initial/terminal flags, transition verbs, actor roles, and primary effects.
- Existing JSON editors, validation messages, Save draft, Publish, and `@enagar/forms/web` citizen preview remain available as the source-of-truth fallback.
- Security contract `tests/security/master-sprint-67.spec.ts` guards the palette/canvas and confirms Sprint 6.2 draft/publish endpoints remain in use.

## Exit Criteria

- Tenant admin can create or reorder form fields from a palette and save/publish the resulting schema without changing the API contract.
- Tenant admin can visually inspect workflow stages/transitions and save/publish the resulting workflow without changing the database contract.
- Invalid form/workflow JSON blocks visual editing with a clear status instead of silently corrupting draft state.
- Existing citizen preview still renders through `@enagar/forms/web`.
- The service designer remains below the project 1600-line file ceiling.
- Admin Tenant typecheck, lint, build, and Sprint 6.7 security contract pass.

## Explicit Non-Goals

- No global service library curator.
- No collaborative multi-user designer state or optimistic conflict resolution.
- No advanced BPMN-style parallel gateways; the v1 canvas stays aligned with the current linear/branching `WorkflowDefinition`.
- No citizen runtime contract change; Sprint 6.6 remains the catalogue/runtime source-of-truth alignment.

## Verification Commands

```bash
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-67.spec.ts tests/security/master-sprint-62.spec.ts
graphify update .
```

## Manual Smoke Test

1. Start infra and API:
   ```bash
   pnpm infra:up
   pnpm --filter @enagar/api prisma:migrate:deploy
   pnpm db:seed
   pnpm --filter @enagar/api dev
   ```
2. Start Tenant Admin:
   ```bash
   pnpm --filter @enagar/admin-tenant dev
   ```
3. Open `http://localhost:3002` and sign in with a seeded KMC/HMC dummy `municipality_admin` or valid tenant admin user.
4. On the dashboard, open **Configure** for a low-risk service such as RTI or Community Hall.
5. In **Visual form builder**, click or drag a **Text** field into the draft, edit its label in the inspector, move it up/down, and confirm the JSON editor updates.
6. Click **Save draft** for the form. Optional: click **Publish** only if you intend to expose the changed form to citizen runtime.
7. In **Visual workflow designer**, click a stage node, edit the label/SLA/role, add one stage, add one transition, and confirm the JSON editor updates.
8. Click **Save draft** for the workflow. Optional: click **Publish** only if the workflow is ready for runtime use.
9. Confirm the right-side citizen preview still renders the updated form fields.
