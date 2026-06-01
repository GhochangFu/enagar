import { deskApplicationInMyQueue } from './desk-queue.util';

describe('deskApplicationInMyQueue', () => {
  it('includes application when pending designation matches any staff designation', () => {
    expect(
      deskApplicationInMyQueue(
        { pending_designation: 'hoarding_clerk', pending_role: null },
        [],
        ['hoarding_clerk', 'hoarding_inspector'],
      ),
    ).toBe(true);
  });

  it('unions multiple designations — inspector queue separate from clerk', () => {
    const clerkApp = { pending_designation: 'hoarding_clerk', pending_role: null };
    const inspectorApp = { pending_designation: 'hoarding_inspector', pending_role: null };
    const codes = ['hoarding_inspector'];

    expect(deskApplicationInMyQueue(clerkApp, [], codes)).toBe(false);
    expect(deskApplicationInMyQueue(inspectorApp, [], codes)).toBe(true);
  });

  it('falls back to pending_role when pending_designation is null', () => {
    expect(
      deskApplicationInMyQueue(
        { pending_designation: null, pending_role: 'tenant_clerk' },
        ['tenant_clerk'],
        [],
      ),
    ).toBe(true);
  });

  it('excludes when neither designation nor role matches', () => {
    expect(
      deskApplicationInMyQueue(
        { pending_designation: 'pwd_executive_engineer', pending_role: null },
        ['tenant_clerk'],
        ['hoarding_clerk'],
      ),
    ).toBe(false);
  });
});
