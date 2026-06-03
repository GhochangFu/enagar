import { createLinearWorkflowDraft, validateWorkflowDefinition } from '@enagar/workflow';

import {
  applyBookingHallTemplate,
  applyHoardingScrutinyTemplate,
  applyMunicipalLadderTemplate,
  applyPwdWorksTemplate,
} from './workflow-designer-templates';

const base = () => createLinearWorkflowDraft('template-audit');

describe('workflow designer templates', () => {
  it('validates hoarding scrutiny with citizen correction from clerk', () => {
    const workflow = applyHoardingScrutinyTemplate(base());
    expect(validateWorkflowDefinition(workflow).ok).toBe(true);
    expect(
      workflow.transitions.some(
        (t) =>
          t.from === 'clerk-verification' &&
          t.to === 'submitted' &&
          t.verb === 'return-for-correction',
      ),
    ).toBe(true);
    const scrutiny = workflow.stages.find((s) => s.code === 'technical-scrutiny');
    expect(scrutiny?.allowed_verbs).not.toContain('forward');
  });

  it('validates PWD works with correction, reject, and trimmed dept-head verbs', () => {
    const workflow = applyPwdWorksTemplate(base());
    expect(validateWorkflowDefinition(workflow).ok).toBe(true);
    expect(
      workflow.transitions.some(
        (t) =>
          t.from === 'maker-review' && t.to === 'submitted' && t.verb === 'return-for-correction',
      ),
    ).toBe(true);
    expect(workflow.stages.some((s) => s.code === 'rejected' && s.terminal)).toBe(true);
    expect(workflow.transitions.filter((t) => t.verb === 'reject').length).toBeGreaterThanOrEqual(
      3,
    );
    const deptHead = workflow.stages.find((s) => s.code === 'dept-head-review');
    expect(deptHead?.allowed_verbs).toEqual([
      'forward-to-eo',
      'forward-to-dept-head-final',
      'return',
      'reject',
    ]);
  });

  it('validates municipal ladder with reject on dept-head and chairperson', () => {
    const workflow = applyMunicipalLadderTemplate(base());
    expect(validateWorkflowDefinition(workflow).ok).toBe(true);
    expect(
      workflow.transitions.some(
        (t) => t.from === 'chairperson-approval' && t.to === 'rejected' && t.verb === 'reject',
      ),
    ).toBe(true);
    const deptHead = workflow.stages.find((s) => s.code === 'dept-head-review');
    expect(deptHead?.allowed_verbs).toEqual([
      'forward-to-eo',
      'forward-to-dept-head-final',
      'reject',
    ]);
  });

  it('validates hall booking template with slot-review and tenant-prefixed code', () => {
    const workflow = applyBookingHallTemplate(base(), 'community-hall');
    expect(validateWorkflowDefinition(workflow).ok).toBe(true);
    expect(workflow.code).toBe('community-hall-booking-v1');
    expect(workflow.stages.some((stage) => stage.code === 'slot-review')).toBe(true);
    expect(workflow.transitions.some((transition) => transition.verb === 'review-slot')).toBe(true);
  });
});
