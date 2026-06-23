jest.mock('./state-global-form.tools', () => ({
  StateGlobalFormTools: class StateGlobalFormTools {
    definitions() {
      return [
        { name: 'applyGlobalFormSchema', description: 'apply', execute: jest.fn() },
        { name: 'proposeGlobalFormFields', description: 'propose', execute: jest.fn() },
      ];
    }
  },
}));

jest.mock('./intent.tools', () => ({
  IntentTools: class IntentTools {
    definitions() {
      return [
        { name: 'detectArchetype', description: 'detect', execute: jest.fn() },
        { name: 'matchGlobalTemplate', description: 'match', execute: jest.fn() },
        { name: 'summarizeRequirements', description: 'summarize', execute: jest.fn() },
      ];
    }
  },
}));

jest.mock('./review.tools', () => ({
  ReviewTools: class ReviewTools {
    definitions() {
      return [
        { name: 'getReadinessChecklist', description: 'checklist', execute: jest.fn() },
        { name: 'explainBlockers', description: 'explain', execute: jest.fn() },
        { name: 'previewCitizenForm', description: 'preview', execute: jest.fn() },
      ];
    }
  },
}));

jest.mock('./tenant-config.tools', () => ({
  TenantConfigTools: class TenantConfigTools {
    definitions() {
      return [
        { name: 'listRevenueHeads', description: 'list', execute: jest.fn() },
        { name: 'proposeFeeRule', description: 'fee', execute: jest.fn() },
        { name: 'setPaymentSchedule', description: 'schedule', execute: jest.fn() },
        { name: 'setRequiredDocuments', description: 'docs', execute: jest.fn() },
        { name: 'setGovernancePolicies', description: 'gov', execute: jest.fn() },
        { name: 'applyServiceConfig', description: 'apply', execute: jest.fn() },
      ];
    }
  },
}));

import { IntentTools } from './intent.tools';
import { ReviewTools } from './review.tools';
import { StateGlobalFormTools } from './state-global-form.tools';
import { TenantConfigTools } from './tenant-config.tools';
import { TenantFormTools } from './tenant-form.tools';
import { TenantWorkflowTools } from './tenant-workflow.tools';
import { SetupToolRegistry } from './tool-registry';

describe('SetupToolRegistry', () => {
  const tenantFormTools = {
    definitions: () => [
      { name: 'applyFormDraft', description: 'apply', execute: jest.fn() },
      { name: 'loadGlobalTemplate', description: 'load', execute: jest.fn() },
      { name: 'proposeFormFields', description: 'propose', execute: jest.fn() },
    ],
  };
  const tenantWorkflowTools = {
    definitions: () => [
      { name: 'applyWorkflowDraft', description: 'apply', execute: jest.fn() },
      { name: 'replaceWorkflowDraft', description: 'replace', execute: jest.fn() },
      { name: 'mergeWorkflowDraft', description: 'merge', execute: jest.fn() },
      { name: 'applyWorkflowTemplate', description: 'template', execute: jest.fn() },
    ],
  };
  const tenantConfigTools = {
    definitions: () => [
      { name: 'listRevenueHeads', description: 'list', execute: jest.fn() },
      { name: 'proposeFeeRule', description: 'fee', execute: jest.fn() },
      { name: 'setPaymentSchedule', description: 'schedule', execute: jest.fn() },
      { name: 'setRequiredDocuments', description: 'docs', execute: jest.fn() },
      { name: 'setGovernancePolicies', description: 'gov', execute: jest.fn() },
      { name: 'applyServiceConfig', description: 'apply', execute: jest.fn() },
    ],
  };
  const intentTools = {
    definitions: () => [
      { name: 'detectArchetype', description: 'detect', execute: jest.fn() },
      { name: 'matchGlobalTemplate', description: 'match', execute: jest.fn() },
      { name: 'summarizeRequirements', description: 'summarize', execute: jest.fn() },
    ],
  };
  const reviewTools = {
    definitions: () => [
      { name: 'getReadinessChecklist', description: 'checklist', execute: jest.fn() },
      { name: 'explainBlockers', description: 'explain', execute: jest.fn() },
      { name: 'previewCitizenForm', description: 'preview', execute: jest.fn() },
    ],
  };
  const stateGlobalFormTools = {
    definitions: () => [
      { name: 'applyGlobalFormSchema', description: 'apply', execute: jest.fn() },
      { name: 'proposeGlobalFormFields', description: 'propose', execute: jest.fn() },
    ],
  };

  const registry = new SetupToolRegistry(
    tenantFormTools as unknown as TenantFormTools,
    tenantWorkflowTools as unknown as TenantWorkflowTools,
    tenantConfigTools as unknown as TenantConfigTools,
    intentTools as unknown as IntentTools,
    reviewTools as unknown as ReviewTools,
    stateGlobalFormTools as unknown as StateGlobalFormTools,
  );

  it('returns tenant form tools on step 2 form scope', () => {
    const tools = registry.getToolsForStep('tenant', 'form', 2);
    expect(tools.map((tool) => tool.name)).toEqual([
      'applyFormDraft',
      'loadGlobalTemplate',
      'proposeFormFields',
    ]);
  });

  it('returns tenant workflow tools on step 3 workflow scope', () => {
    const tools = registry.getToolsForStep('tenant', 'workflow', 3);
    expect(tools.map((tool) => tool.name)).toEqual([
      'applyWorkflowDraft',
      'replaceWorkflowDraft',
      'mergeWorkflowDraft',
      'applyWorkflowTemplate',
    ]);
  });

  it('returns config tools on step 4 payment scope', () => {
    const tools = registry.getToolsForStep('tenant', 'payment', 4);
    expect(tools.map((tool) => tool.name)).toEqual([
      'listRevenueHeads',
      'proposeFeeRule',
      'setPaymentSchedule',
      'setRequiredDocuments',
      'setGovernancePolicies',
      'applyServiceConfig',
    ]);
  });

  it('returns intent tools on step 1 full scope only', () => {
    expect(registry.getToolsForStep('tenant', 'full', 1).map((tool) => tool.name)).toEqual([
      'detectArchetype',
      'matchGlobalTemplate',
      'summarizeRequirements',
    ]);
    expect(registry.getToolsForStep('tenant', 'payment', 1)).toEqual([]);
  });

  it('returns review tools on step 5 for any tenant scope', () => {
    const tools = registry.getToolsForStep('tenant', 'review', 5);
    expect(tools.map((tool) => tool.name)).toEqual([
      'getReadinessChecklist',
      'explainBlockers',
      'previewCitizenForm',
    ]);
  });

  it('rejects disallowed tool execution', async () => {
    await expect(
      registry.executeTool('tenant', 'applyGlobalFormSchema', {} as never, {}),
    ).rejects.toThrow('not allowed');
  });
});
