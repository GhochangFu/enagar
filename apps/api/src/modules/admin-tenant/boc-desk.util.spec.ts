import { describe, expect, it } from '@jest/globals';

import {
  applyBocTransitionPayload,
  deskRuntimeSnapshotForEvaluation,
  deskSnapshotForAllowedTransition,
  readBocPolicy,
} from './boc-desk.util';

describe('boc-desk.util', () => {
  it('reads boc_policy from override_config', () => {
    expect(readBocPolicy({ boc_policy: 'always' })).toBe('always');
    expect(readBocPolicy({})).toBe('never');
  });

  it('forces requires_boc_resolution for always and clears for never', () => {
    expect(
      deskRuntimeSnapshotForEvaluation(
        { boc_policy: 'always' },
        {},
        { currentStage: 'technical-scrutiny' },
      ).requires_boc_resolution,
    ).toBe(true);
    expect(
      deskRuntimeSnapshotForEvaluation(
        { boc_policy: 'never' },
        { requires_boc_resolution: true },
        { currentStage: 'technical-scrutiny' },
      ).requires_boc_resolution,
    ).toBe(false);
  });

  it('merges officer require_boc at technical-scrutiny', () => {
    const snapshot = applyBocTransitionPayload(
      { boc_policy: 'officer_may_require' },
      {},
      'forward',
      { require_boc: true },
      'technical-scrutiny',
    );
    expect(snapshot.requires_boc_resolution).toBe(true);
  });

  it('previews boc_required and boc_not_required branches for officer_may_require', () => {
    const config = { boc_policy: 'officer_may_require' };
    const base = {};
    expect(
      deskSnapshotForAllowedTransition(config, base, 'technical-scrutiny', {
        type: 'boc_required',
      }).requires_boc_resolution,
    ).toBe(true);
    expect(
      deskSnapshotForAllowedTransition(config, base, 'technical-scrutiny', {
        type: 'boc_not_required',
      }).requires_boc_resolution,
    ).toBe(false);
  });

  it('rejects require_boc when policy is never', () => {
    expect(() =>
      applyBocTransitionPayload(
        { boc_policy: 'never' },
        {},
        'forward',
        { require_boc: true },
        'technical-scrutiny',
      ),
    ).toThrow('BOC resolution cannot be required');
  });
});
