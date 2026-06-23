import { areDraftLayersReady, canSkipToReview, nextStep, previousStep } from '@enagar/types';

describe('setup-assistant-flow', () => {
  it('nextStep skips completed layers in full scope', () => {
    expect(nextStep('full', 1, { '2': true, '3': false, '4': false })).toBe(3);
  });

  it('nextStep is sequential for partial scopes', () => {
    expect(nextStep('form', 2, { '2': true })).toBe(5);
  });

  it('previousStep walks back within scope', () => {
    expect(previousStep('full', 3)).toBe(2);
    expect(previousStep('form', 2)).toBeNull();
  });

  it('canSkipToReview for partial scope when current step complete', () => {
    expect(canSkipToReview('form', 2, { '2': true })).toBe(true);
    expect(canSkipToReview('form', 2, {})).toBe(false);
  });

  it('canSkipToReview for full scope when steps 1-4 complete', () => {
    expect(
      canSkipToReview('full', 4, {
        '1': true,
        '2': true,
        '3': true,
        '4': true,
      }),
    ).toBe(true);
    expect(canSkipToReview('full', 2, { '2': true })).toBe(false);
  });

  it('areDraftLayersReady requires all draft checklist keys green', () => {
    expect(
      areDraftLayersReady({
        ready_to_publish: false,
        items: [
          { key: 'form_draft_valid', label: 'Form', status: 'green' },
          { key: 'workflow_draft_valid', label: 'Workflow', status: 'green' },
          { key: 'config_complete', label: 'Config', status: 'green' },
          { key: 'booking_assets', label: 'Assets', status: 'green' },
        ],
      }),
    ).toBe(true);
    expect(
      areDraftLayersReady({
        ready_to_publish: false,
        items: [
          { key: 'form_draft_valid', label: 'Form', status: 'amber' },
          { key: 'workflow_draft_valid', label: 'Workflow', status: 'green' },
          { key: 'config_complete', label: 'Config', status: 'green' },
          { key: 'booking_assets', label: 'Assets', status: 'green' },
        ],
      }),
    ).toBe(false);
  });
});
