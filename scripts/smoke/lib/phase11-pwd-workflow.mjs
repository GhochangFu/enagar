/**
 * PWD workflow with post-approval payment block (Phase 11).
 * Extends Phase 9 ladder; replaces dept-head-final → closed with payment stages.
 */
import { phase9PwdSmokeWorkflow } from './phase9-pwd-workflow.mjs';

export function phase11PwdSmokeWorkflow(serviceCode) {
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
      to: 'closed',
      verb: 'forward',
      actor_role: 'system',
      effects: audit,
    },
  );

  return { ...base, stages, transitions };
}
