/**
 * Minimal designation workflow for Phase 8 Desk UI smoke (return + reject).
 * Workflow code must be `${serviceCode}-…` (Tenant Admin saveWorkflowDraft rule).
 */
export function phase8DeskSmokeWorkflow(serviceCode) {
  const label = (en) => ({ en, bn: en, hi: en });
  const prefix = `${String(serviceCode).trim()}-`;
  return {
    code: `${prefix}phase8-desk-smoke-v1`,
    version: 1,
    stages: [
      {
        code: 'submitted',
        label: label('Submitted'),
        // Staff-owned after citizen API submit so Desk clerk can open the docket (hoarding-boc smoke pattern).
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_clerk',
        initial: true,
      },
      {
        code: 'maker-review',
        label: label('Maker review'),
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_clerk',
        stage_kind: 'maker',
        allowed_verbs: ['forward', 'return', 'reject'],
      },
      {
        code: 'checker-review',
        label: label('Checker review'),
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_inspector',
        stage_kind: 'checker',
        allowed_verbs: ['forward', 'return'],
      },
      {
        code: 'dept-head-review',
        label: label('Department head'),
        owner_role: 'tenant_admin',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
        allowed_verbs: ['forward', 'return', 'reject'],
      },
      {
        code: 'rejected',
        label: label('Rejected'),
        owner_role: 'citizen',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'submitted',
        to: 'maker-review',
        verb: 'forward',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_clerk',
      },
      {
        from: 'maker-review',
        to: 'checker-review',
        verb: 'forward',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_clerk',
      },
      {
        from: 'checker-review',
        to: 'maker-review',
        verb: 'return',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_inspector',
      },
      {
        from: 'maker-review',
        to: 'rejected',
        verb: 'reject',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_clerk',
      },
      {
        from: 'checker-review',
        to: 'dept-head-review',
        verb: 'forward',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_inspector',
      },
      {
        from: 'dept-head-review',
        to: 'rejected',
        verb: 'reject',
        actor_role: 'tenant_clerk',
        actor_designation: 'pwd_executive_engineer',
        requires_comment: true,
      },
    ],
  };
}
