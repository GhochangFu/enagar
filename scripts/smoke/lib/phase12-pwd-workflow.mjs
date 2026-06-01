/**
 * PWD workflow with post-approval payment + work-order execution (Phase 12).
 */
import { phase9PwdSmokeWorkflow } from './phase9-pwd-workflow.mjs';

export function phase12PwdSmokeWorkflow(serviceCode) {
  const base = phase9PwdSmokeWorkflow(serviceCode);
  const label = (en) => ({ en, bn: en, hi: en });
  const audit = [{ type: 'audit' }];

  const stages = base.stages.filter((stage) => stage.code !== 'closed');
  stages.push(
    {
      code: 'payment-pending',
      label: label('Payment pending'),
      owner_role: 'tenant_clerk',
      owner_designation: 'pwd_executive_engineer',
      stage_kind: 'post_approval',
    },
    {
      code: 'payment-received',
      label: label('Payment received'),
      owner_role: 'system',
      stage_kind: 'system',
      allowed_verbs: ['forward'],
    },
    {
      code: 'work-order-issued',
      label: label('Work order issued'),
      owner_role: 'tenant_clerk',
      owner_designation: 'pwd_executive_engineer',
      stage_kind: 'post_approval',
      allowed_verbs: ['forward'],
    },
    {
      code: 'work-in-progress',
      label: label('Work in progress'),
      owner_role: 'tenant_clerk',
      owner_designation: 'pwd_executive_engineer',
      stage_kind: 'post_approval',
      allowed_verbs: ['forward'],
    },
    {
      code: 'work-completed',
      label: label('Work completed'),
      owner_role: 'tenant_clerk',
      owner_designation: 'pwd_executive_engineer',
      stage_kind: 'post_approval',
      allowed_verbs: ['forward'],
    },
    {
      code: 'citizen-feedback',
      label: label('Citizen feedback'),
      owner_role: 'citizen',
      stage_kind: 'citizen',
      allowed_verbs: ['submit-feedback'],
    },
    {
      code: 'closed',
      label: label('Closed'),
      owner_role: 'citizen',
      terminal: true,
    },
  );

  const transitions = base.transitions.filter(
    (row) => !(row.from === 'dept-head-final' && row.to === 'closed' && row.verb === 'forward'),
  );
  transitions.push(
    {
      from: 'dept-head-final',
      to: 'payment-pending',
      verb: 'forward',
      actor_role: 'tenant_clerk',
      actor_designation: 'pwd_executive_engineer',
      effects: [...audit, { type: 'generate_payment_link', payload: { fee_code: 'approval' } }],
    },
    {
      from: 'payment-pending',
      to: 'payment-received',
      verb: 'confirm-payment',
      actor_role: 'system',
      guard: { type: 'payment_paid', fee_code: 'approval' },
      effects: audit,
    },
    {
      from: 'payment-received',
      to: 'work-order-issued',
      verb: 'forward',
      actor_role: 'system',
      guard: { type: 'approval_fee_paid' },
      effects: [...audit, { type: 'create_work_order' }],
    },
    {
      from: 'work-order-issued',
      to: 'work-in-progress',
      verb: 'forward',
      actor_role: 'tenant_clerk',
      actor_designation: 'pwd_executive_engineer',
      guard: { type: 'approval_fee_paid' },
      effects: audit,
    },
    {
      from: 'work-in-progress',
      to: 'work-completed',
      verb: 'forward',
      actor_role: 'tenant_clerk',
      actor_designation: 'pwd_executive_engineer',
      guard: { type: 'approval_fee_paid' },
      effects: audit,
    },
    {
      from: 'work-completed',
      to: 'citizen-feedback',
      verb: 'forward',
      actor_role: 'tenant_clerk',
      actor_designation: 'pwd_executive_engineer',
      guard: { type: 'approval_fee_paid' },
      effects: audit,
    },
    {
      from: 'citizen-feedback',
      to: 'closed',
      verb: 'submit-feedback',
      actor_role: 'citizen',
      effects: audit,
    },
  );

  return { ...base, stages, transitions };
}
