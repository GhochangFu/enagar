import { grievanceCreateWriteScope, grievanceRowTenantScope } from './grievance-scope';

describe('grievance scope (Sprint 4.2)', () => {
  const catalogue = [
    { id: 't1', code: 'KMC' },
    { id: 't2', code: 'HMC' },
  ] as const;

  it('grievanceRowTenantScope prefers workspace code', () => {
    expect(
      grievanceRowTenantScope({
        workspaceTenantCode: '  KMC  ',
        grievanceTenantId: 't2',
        hubCatalogue: catalogue,
      }),
    ).toBe('KMC');
  });

  it('grievanceRowTenantScope maps hub row tenant_id via catalogue', () => {
    expect(
      grievanceRowTenantScope({
        workspaceTenantCode: undefined,
        grievanceTenantId: 't2',
        hubCatalogue: catalogue,
      }),
    ).toBe('HMC');
  });

  it('grievanceRowTenantScope returns undefined when hub has no match', () => {
    expect(
      grievanceRowTenantScope({
        workspaceTenantCode: null,
        grievanceTenantId: 'unknown',
        hubCatalogue: catalogue,
      }),
    ).toBeUndefined();
  });

  it('grievanceCreateWriteScope prefers workspace over filing pick', () => {
    expect(
      grievanceCreateWriteScope({
        workspaceTenantCode: 'KMC',
        filingTenantCode: 'HMC',
      }),
    ).toBe('KMC');
  });

  it('grievanceCreateWriteScope uses filing pick in hub mode', () => {
    expect(
      grievanceCreateWriteScope({
        workspaceTenantCode: undefined,
        filingTenantCode: '  HMC ',
      }),
    ).toBe('HMC');
  });
});
