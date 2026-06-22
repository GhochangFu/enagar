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

import { StateGlobalFormTools } from './state-global-form.tools';
import { TenantFormTools } from './tenant-form.tools';
import { SetupToolRegistry } from './tool-registry';

describe('SetupToolRegistry', () => {
  const tenantFormTools = {
    definitions: () => [
      { name: 'applyFormDraft', description: 'apply', execute: jest.fn() },
      { name: 'loadGlobalTemplate', description: 'load', execute: jest.fn() },
      { name: 'proposeFormFields', description: 'propose', execute: jest.fn() },
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

  it('returns no tools on workflow step', () => {
    expect(registry.getToolsForStep('tenant', 'workflow', 3)).toEqual([]);
  });

  it('rejects disallowed tool execution', async () => {
    await expect(
      registry.executeTool('tenant', 'applyGlobalFormSchema', {} as never, {}),
    ).rejects.toThrow('not allowed');
  });
});
