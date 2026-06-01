/**
 * PWD + municipal ladder workflow for Phase 9 Desk UI smoke.
 * Mirrors applyPwdWorksTemplate + insertMunicipalSignoffBlock (guarded skip/ladder).
 */
export function phase9PwdSmokeWorkflow(serviceCode) {
  const label = (en) => ({ en, bn: en, hi: en });
  const audit = [{ type: 'audit' }];
  const prefix = `${String(serviceCode).trim()}-`;
  const t = (from, to, verb, designation, extra = {}) => ({
    from,
    to,
    verb,
    actor_role: designation === 'citizen' ? 'citizen' : 'tenant_clerk',
    actor_designation: designation === 'citizen' ? undefined : designation,
    effects: audit,
    ...extra,
  });

  return {
    code: `${prefix}workflow-v1`,
    version: 1,
    stages: [
      {
        code: 'submitted',
        label: label('Submitted'),
        owner_role: 'citizen',
        initial: true,
        allowed_verbs: ['forward'],
      },
      {
        code: 'maker-review',
        label: label('Maker review'),
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_junior_engineer',
        stage_kind: 'maker',
        allowed_verbs: ['forward', 'return-for-correction'],
      },
      {
        code: 'checker-review',
        label: label('Checker review'),
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_assistant_engineer',
        stage_kind: 'checker',
        allowed_verbs: ['forward', 'return'],
      },
      {
        code: 'approver-review',
        label: label('Approver review'),
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_assistant_engineer',
        stage_kind: 'approver',
        allowed_verbs: ['forward', 'return'],
      },
      {
        code: 'dept-head-review',
        label: label('Department head review'),
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
        allowed_verbs: ['forward', 'forward-to-eo', 'forward-to-dept-head-final', 'return', 'reject'],
      },
      {
        code: 'eo-approval',
        label: label('Executive Officer approval'),
        owner_role: 'tenant_clerk',
        owner_designation: 'executive_officer',
        stage_kind: 'municipality',
        allowed_verbs: ['forward', 'return'],
      },
      {
        code: 'cic-approval',
        label: label('Commissioner in Council approval'),
        owner_role: 'tenant_clerk',
        owner_designation: 'cic',
        stage_kind: 'municipality',
        allowed_verbs: ['forward', 'return'],
      },
      {
        code: 'vc-approval',
        label: label('Vice-Chairperson approval'),
        owner_role: 'tenant_clerk',
        owner_designation: 'vice_chairperson',
        stage_kind: 'municipality',
        allowed_verbs: ['forward', 'return'],
      },
      {
        code: 'chairperson-approval',
        label: label('Chairperson approval'),
        owner_role: 'tenant_clerk',
        owner_designation: 'chairperson',
        stage_kind: 'municipality',
        allowed_verbs: ['forward', 'return', 'reject'],
      },
      {
        code: 'dept-head-final',
        label: label('Department head (final)'),
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
        allowed_verbs: ['forward', 'return', 'reject'],
      },
      {
        code: 'closed',
        label: label('Closed'),
        owner_role: 'citizen',
        terminal: true,
      },
    ],
    transitions: [
      t('submitted', 'maker-review', 'forward', 'citizen'),
      t('maker-review', 'checker-review', 'forward', 'pwd_junior_engineer'),
      t('checker-review', 'maker-review', 'return', 'pwd_assistant_engineer'),
      t('checker-review', 'approver-review', 'forward', 'pwd_assistant_engineer'),
      t('approver-review', 'checker-review', 'return', 'pwd_assistant_engineer'),
      t('approver-review', 'dept-head-review', 'forward', 'pwd_assistant_engineer'),
      t('dept-head-review', 'approver-review', 'return', 'pwd_executive_engineer'),
      t('dept-head-review', 'eo-approval', 'forward-to-eo', 'pwd_executive_engineer', {
        guard: { type: 'municipal_signoff_required' },
      }),
      t('dept-head-review', 'dept-head-final', 'forward-to-dept-head-final', 'pwd_executive_engineer', {
        guard: { type: 'municipal_signoff_not_required' },
      }),
      t('eo-approval', 'cic-approval', 'forward', 'executive_officer'),
      t('cic-approval', 'vc-approval', 'forward', 'cic'),
      t('vc-approval', 'chairperson-approval', 'forward', 'vice_chairperson'),
      t('chairperson-approval', 'dept-head-final', 'forward', 'chairperson'),
      t('chairperson-approval', 'vc-approval', 'return', 'chairperson'),
      t('vc-approval', 'cic-approval', 'return', 'vice_chairperson'),
      t('cic-approval', 'eo-approval', 'return', 'cic'),
      t('eo-approval', 'dept-head-final', 'return', 'executive_officer'),
      t('dept-head-final', 'closed', 'forward', 'pwd_executive_engineer'),
    ],
  };
}
