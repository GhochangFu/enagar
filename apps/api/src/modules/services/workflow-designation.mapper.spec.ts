import {
  mapWorkflowStageToDefinition,
  mapWorkflowTransitionToDefinition,
  pendingActorFromStage,
  pendingActorFromWorkflowStage,
  workflowDefinitionFromRows,
} from './workflow-designation.mapper';

describe('workflow-designation.mapper', () => {
  it('dual-reads designation fields from workflow stage rows', () => {
    const stage = mapWorkflowStageToDefinition({
      code: 'maker-review',
      label: { en: 'Maker', bn: 'Maker', hi: 'Maker' },
      ownerRole: 'tenant_clerk',
      ownerDesignation: 'pwd_junior_engineer',
      stageKind: 'maker',
      allowedVerbs: ['forward', 'return'],
      slaHours: 24,
      isInitial: false,
      isTerminal: false,
      sortOrder: 1,
    });

    expect(stage).toMatchObject({
      owner_role: 'tenant_clerk',
      owner_designation: 'pwd_junior_engineer',
      stage_kind: 'maker',
      allowed_verbs: ['forward', 'return'],
    });
  });

  it('dual-reads guard and actor designation from transition rows', () => {
    const transition = mapWorkflowTransitionToDefinition({
      verb: 'forward',
      actorRole: 'tenant_admin',
      actorDesignation: 'executive_officer',
      guard: { kind: 'municipal_signoff_required' },
      requiresComment: false,
      sideEffects: [],
      fromStage: { code: 'dept-head-review' },
      toStage: { code: 'eo-approval' },
    });

    expect(transition).toMatchObject({
      actor_role: 'tenant_admin',
      actor_designation: 'executive_officer',
      guard: { kind: 'municipal_signoff_required' },
    });
  });

  it('prefers pending_designation over pending_role when owner designation is set', () => {
    expect(
      pendingActorFromStage({
        ownerDesignation: 'pwd_executive_engineer',
        ownerRole: 'tenant_admin',
      }),
    ).toEqual({
      pending_designation: 'pwd_executive_engineer',
      pending_role: null,
    });
    expect(
      pendingActorFromWorkflowStage({
        code: 'submitted',
        label: { en: 'Submitted', bn: 'Submitted', hi: 'Submitted' },
        owner_role: 'tenant_clerk',
      }),
    ).toEqual({
      pending_designation: null,
      pending_role: 'tenant_clerk',
    });
  });

  it('builds a workflow definition from prisma rows', () => {
    const definition = workflowDefinitionFromRows(
      'pwd-v1',
      1,
      [
        {
          code: 'submitted',
          label: { en: 'Submitted', bn: 'Submitted', hi: 'Submitted' },
          ownerRole: 'tenant_clerk',
          ownerDesignation: null,
          stageKind: 'citizen',
          allowedVerbs: null,
          slaHours: null,
          isInitial: true,
          isTerminal: false,
          sortOrder: 0,
        },
      ],
      [],
    );

    expect(definition.code).toBe('pwd-v1');
    expect(definition.stages[0]?.stage_kind).toBe('citizen');
  });
});
