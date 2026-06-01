import {
  applyMunicipalSignoffPolicyToSnapshot,
  municipalSignoffBranchPreview,
  readMunicipalSignoffPolicy,
  readMunicipalSignoffThresholdPaise,
  type MunicipalSignoffPolicy,
} from '@enagar/workflow';

export function readMunicipalSignoffPolicyFromConfig(
  overrideConfig: unknown,
): MunicipalSignoffPolicy {
  return readMunicipalSignoffPolicy(overrideConfig);
}

export function readMunicipalSignoffThresholdFromConfig(overrideConfig: unknown): number {
  return readMunicipalSignoffThresholdPaise(overrideConfig);
}

function guardType(guard: Record<string, unknown> | undefined): string {
  if (!guard) {
    return '';
  }
  const type = guard.type;
  return typeof type === 'string' ? type : typeof guard.kind === 'string' ? guard.kind : '';
}

export function applyMunicipalSignoffToDeskSnapshot(
  overrideConfig: unknown,
  snapshot: Record<string, unknown>,
  options?: { feePreviewPaise?: number | null },
): Record<string, unknown> {
  const policy = readMunicipalSignoffPolicy(overrideConfig);
  const threshold = readMunicipalSignoffThresholdPaise(overrideConfig);
  return applyMunicipalSignoffPolicyToSnapshot(policy, snapshot, {
    thresholdPaise: threshold,
    feePreviewPaise: options?.feePreviewPaise,
  });
}

/** Preview municipal ladder vs skip branches when listing allowed transitions. */
export function deskSnapshotForMunicipalGuard(
  overrideConfig: unknown,
  snapshot: Record<string, unknown>,
  transitionGuard: Record<string, unknown> | undefined,
  options?: { feePreviewPaise?: number | null },
): Record<string, unknown> {
  const policy = readMunicipalSignoffPolicy(overrideConfig);
  const threshold = readMunicipalSignoffThresholdPaise(overrideConfig);
  const kind = guardType(transitionGuard);
  if (
    policy === 'high_value_only' &&
    (kind === 'municipal_signoff_required' ||
      kind === 'municipal_signoff_not_required' ||
      kind === 'municipal_signoff_skip')
  ) {
    return municipalSignoffBranchPreview(policy, snapshot, transitionGuard, {
      thresholdPaise: threshold,
      feePreviewPaise: options?.feePreviewPaise,
    });
  }
  return applyMunicipalSignoffToDeskSnapshot(overrideConfig, snapshot, options);
}
