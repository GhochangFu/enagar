import {
  formatPendingAtLabelFromDesignationRow,
  legacyPendingRoleLabel,
  resolvePendingAtLabelSync,
} from './pending-at-label.util';

describe('pending-at-label', () => {
  it('formats designation and department for citizen pending-at', () => {
    const label = formatPendingAtLabelFromDesignationRow({
      code: 'hoarding_clerk',
      name: { en: 'Hoarding Clerk' },
      department: { code: 'advertisement-hoarding', name: { en: 'Advertising & Hoarding' } },
    });
    expect(label).toBe('Hoarding Clerk — Advertising & Hoarding');
  });

  it('uses municipality designation name only when no department', () => {
    const label = formatPendingAtLabelFromDesignationRow({
      code: 'executive_officer',
      name: { en: 'Executive Officer' },
      department: null,
    });
    expect(label).toBe('Executive Officer');
  });

  it('prefers designation label over legacy pending_role', () => {
    const map = new Map([
      [
        'pwd_executive_engineer',
        {
          code: 'pwd_executive_engineer',
          name: { en: 'Executive Engineer' },
          department: { code: 'public-works', name: { en: 'Public Works' } },
        },
      ],
    ]);
    expect(
      resolvePendingAtLabelSync(
        { pending_designation: 'pwd_executive_engineer', pending_role: 'tenant_clerk' },
        map,
      ),
    ).toBe('Executive Engineer — Public Works');
  });

  it('maps legacy pending_role when designation is absent', () => {
    expect(
      resolvePendingAtLabelSync(
        { pending_designation: null, pending_role: 'tenant_clerk' },
        new Map(),
      ),
    ).toBe('Municipal clerk');
    expect(legacyPendingRoleLabel('front-office')).toBe('Front office');
  });
});
