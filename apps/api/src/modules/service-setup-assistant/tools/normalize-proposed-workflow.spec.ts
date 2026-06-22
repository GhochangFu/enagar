import { createLinearWorkflowDraft } from '@enagar/workflow';

import {
  insertWorkflowStage,
  normalizeMergeWorkflowArgs,
  removeWorkflowStage,
  resolveStageReference,
} from './normalize-proposed-workflow';

describe('normalize-proposed-workflow', () => {
  const serviceCode = 'trade-licence';
  const base = createLinearWorkflowDraft(serviceCode, 1);

  it('inserts tenant admin verification before approved from flat LLM args', () => {
    const merged = normalizeMergeWorkflowArgs(
      {
        stage_code: 'tenant-verification',
        stage_name: 'Tenant Admin Verification',
        stage_type: 'tenant_admin',
        insert_before: 'approved',
      },
      base,
    );

    expect(merged.stages.map((stage) => stage.code)).toEqual([
      'submitted',
      'tenant-verification',
      'approved',
      'closed',
    ]);
    expect(
      merged.transitions.some((t) => t.from === 'submitted' && t.to === 'tenant-verification'),
    ).toBe(true);
    expect(
      merged.transitions.some((t) => t.from === 'tenant-verification' && t.to === 'approved'),
    ).toBe(true);
    expect(merged.transitions.some((t) => t.from === 'submitted' && t.to === 'approved')).toBe(
      false,
    );
  });

  it('defaults tenant_admin stage before approved when position omitted', () => {
    const merged = normalizeMergeWorkflowArgs(
      {
        stage_code: 'tenant-verification',
        stage_name: 'Tenant Admin Verification',
        stage_type: 'tenant_admin',
      },
      base,
    );

    const verificationIndex = merged.stages.findIndex(
      (stage) => stage.code === 'tenant-verification',
    );
    const approvedIndex = merged.stages.findIndex((stage) => stage.code === 'approved');
    expect(verificationIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeLessThan(approvedIndex);
  });

  it('resolves stage references by English label', () => {
    expect(resolveStageReference(base, 'Approved')).toBe('approved');
    expect(resolveStageReference(base, 'Submitted')).toBe('submitted');
  });

  it('insertWorkflowStage rewires outgoing transition when inserting after anchor', () => {
    const stage = {
      code: 'clerk-review',
      label: { en: 'Clerk review', bn: 'Clerk review', hi: 'Clerk review' },
      owner_role: 'tenant_clerk' as const,
    };
    const merged = insertWorkflowStage(base, stage, { kind: 'after', stageCode: 'submitted' });
    expect(merged.transitions.some((t) => t.from === 'submitted' && t.to === 'clerk-review')).toBe(
      true,
    );
    expect(merged.transitions.some((t) => t.from === 'clerk-review' && t.to === 'approved')).toBe(
      true,
    );
  });

  it('removeWorkflowStage bridges neighbors and drops removed stage', () => {
    const withVerification = normalizeMergeWorkflowArgs(
      {
        stage_code: 'tenant-verification',
        stage_name: 'Tenant Admin Verification',
        stage_type: 'tenant_admin',
        insert_before: 'approved',
      },
      base,
    );

    const merged = removeWorkflowStage(withVerification, 'tenant-verification');

    expect(merged.stages.map((stage) => stage.code)).toEqual(['submitted', 'approved', 'closed']);
    expect(merged.transitions.some((t) => t.from === 'submitted' && t.to === 'approved')).toBe(
      true,
    );
    expect(merged.transitions.some((t) => t.to === 'tenant-verification')).toBe(false);
    expect(merged.transitions.some((t) => t.from === 'tenant-verification')).toBe(false);
  });

  it('removeWorkflowStage resolves label with code in parentheses', () => {
    const withVerification = normalizeMergeWorkflowArgs(
      {
        stage_code: 'tenant-verification',
        stage_name: 'Tenant Admin Verification',
        stage_type: 'tenant_admin',
        insert_before: 'approved',
      },
      base,
    );

    const merged = removeWorkflowStage(
      withVerification,
      'Tenant Admin Verification (tenant-verification)',
    );

    expect(merged.stages.map((stage) => stage.code)).not.toContain('tenant-verification');
  });

  it('dedupes transitions when re-inserting an existing stage', () => {
    const withVerification = normalizeMergeWorkflowArgs(
      {
        stage_code: 'tenant-verification',
        stage_name: 'Tenant Admin Verification',
        stage_type: 'tenant_admin',
        insert_before: 'approved',
      },
      base,
    );

    const merged = normalizeMergeWorkflowArgs(
      {
        stage_code: 'tenant-verification',
        stage_name: 'Tenant Admin Verification',
        stage_type: 'tenant_admin',
        insert_after: 'submitted',
      },
      withVerification,
    );

    const keys = merged.transitions.map((t) => `${t.from}|${t.verb}`.toLowerCase());
    expect(keys.length).toBe(new Set(keys).size);
  });
});
