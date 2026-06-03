import { bookingWorkflow } from '@enagar/workflow';

import { isBookingWorkflowCode, workflowDefinitionIsBooking } from './booking-workflow.util';

describe('booking-workflow.util', () => {
  it('recognizes catalogue and tenant-prefixed booking workflow codes', () => {
    expect(isBookingWorkflowCode('booking-v1')).toBe(true);
    expect(isBookingWorkflowCode('community-hall-booking-v1')).toBe(true);
    expect(isBookingWorkflowCode('birth-cert-workflow-v1')).toBe(false);
  });

  it('detects booking definition by slot-review stage', () => {
    expect(workflowDefinitionIsBooking(bookingWorkflow)).toBe(true);
    expect(
      workflowDefinitionIsBooking({
        code: 'custom-workflow-v2',
        stages: [
          { code: 'slot-review', label: { en: 'x', bn: 'x', hi: 'x' }, owner_role: 'tenant_clerk' },
        ],
        transitions: [],
      }),
    ).toBe(true);
  });
});
