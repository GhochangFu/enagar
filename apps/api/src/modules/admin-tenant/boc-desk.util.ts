import {
  applyBocPolicyToSnapshot,
  assertRequireBocAllowed,
  mergeBocResolutionIntoSnapshot,
  mergeOfficerRequireBoc,
  officerMaySetRequireBoc,
  parseBocPolicy,
  type BocPolicy,
  type BocResolutionPayload,
  validateBocResolutionForTransition,
} from '@enagar/workflow';
import { BadRequestException } from '@nestjs/common';

import {
  applyMunicipalSignoffToDeskSnapshot,
  deskSnapshotForMunicipalGuard,
} from './municipal-desk.util';

export function readBocPolicy(overrideConfig: unknown): BocPolicy {
  return parseBocPolicy(overrideConfig);
}

export function deskRuntimeSnapshotForEvaluation(
  overrideConfig: unknown,
  snapshot: Record<string, unknown>,
  options: {
    currentStage: string;
    requireBoc?: boolean;
    feePreviewPaise?: number | null;
  },
): Record<string, unknown> {
  const policy = readBocPolicy(overrideConfig);
  try {
    assertRequireBocAllowed(policy, options.requireBoc);
    const withOfficer = mergeOfficerRequireBoc(
      policy,
      snapshot,
      options.requireBoc,
      options.currentStage,
    );
    const withBoc = applyBocPolicyToSnapshot(policy, withOfficer);
    return applyMunicipalSignoffToDeskSnapshot(overrideConfig, withBoc, {
      feePreviewPaise: options.feePreviewPaise,
    });
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Invalid BOC request');
  }
}

function guardType(guard: Record<string, unknown> | undefined): string {
  if (!guard) {
    return '';
  }
  const type = guard.type;
  return typeof type === 'string' ? type : typeof guard.kind === 'string' ? guard.kind : '';
}

/** Preview both BOC branches at technical-scrutiny when policy is officer_may_require. */
export function deskSnapshotForAllowedTransition(
  overrideConfig: unknown,
  snapshot: Record<string, unknown>,
  currentStage: string,
  transitionGuard: Record<string, unknown> | undefined,
  options?: { feePreviewPaise?: number | null },
): Record<string, unknown> {
  const policy = readBocPolicy(overrideConfig);
  let base = deskRuntimeSnapshotForEvaluation(overrideConfig, snapshot, {
    currentStage,
    feePreviewPaise: options?.feePreviewPaise,
  });
  if (officerMaySetRequireBoc(policy, currentStage)) {
    const kind = guardType(transitionGuard);
    if (kind === 'boc_required') {
      base = { ...base, requires_boc_resolution: true };
    } else if (kind === 'boc_skip' || kind === 'boc_not_required') {
      base = { ...base, requires_boc_resolution: false };
    }
  }
  return deskSnapshotForMunicipalGuard(overrideConfig, base, transitionGuard, options);
}

export function applyBocTransitionPayload(
  overrideConfig: unknown,
  snapshot: Record<string, unknown>,
  verb: string,
  payload: {
    require_boc?: boolean;
    boc_resolution?: BocResolutionPayload;
  },
  currentStage: string,
  options?: { feePreviewPaise?: number | null },
): Record<string, unknown> {
  const policy = readBocPolicy(overrideConfig);
  try {
    validateBocResolutionForTransition(verb, policy, payload.boc_resolution);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Invalid BOC resolution',
    );
  }

  let next = deskRuntimeSnapshotForEvaluation(overrideConfig, snapshot, {
    currentStage,
    requireBoc: payload.require_boc,
    feePreviewPaise: options?.feePreviewPaise,
  });

  if (payload.boc_resolution) {
    next = mergeBocResolutionIntoSnapshot(next, payload.boc_resolution);
  }

  return next;
}
