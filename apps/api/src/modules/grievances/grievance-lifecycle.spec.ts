import { assertGrievanceTransition } from './grievance-lifecycle';

describe('grievance lifecycle', () => {
  it('allows submitted → under_review and submitted → in_progress', () => {
    expect(() => assertGrievanceTransition('submitted', 'under_review')).not.toThrow();
    expect(() => assertGrievanceTransition('submitted', 'in_progress')).not.toThrow();
  });

  it('allows resolved → under_review (citizen Sprint 4.3 reopen) and rejects resolved → in_progress directly', () => {
    expect(() => assertGrievanceTransition('resolved', 'under_review')).not.toThrow();
    expect(() => assertGrievanceTransition('resolved', 'in_progress')).toThrow();
  });
});
