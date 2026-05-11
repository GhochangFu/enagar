import { assertGrievanceTransition } from './grievance-lifecycle';

describe('grievance lifecycle', () => {
  it('allows submitted → under_review and submitted → in_progress', () => {
    expect(() => assertGrievanceTransition('submitted', 'under_review')).not.toThrow();
    expect(() => assertGrievanceTransition('submitted', 'in_progress')).not.toThrow();
  });

  it('rejects illegal transitions', () => {
    expect(() => assertGrievanceTransition('closed', 'submitted')).toThrow();
    expect(() => assertGrievanceTransition('resolved', 'in_progress')).toThrow();
  });
});
