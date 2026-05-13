import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

describe('Hub H5.1 — Keycloak realm export vs API grievance staff roles', () => {
  const realmJson = readFileSync(
    join(repoRoot, 'infrastructure', 'keycloak', 'realm-export.json'),
    'utf8',
  );
  const staffRolesSource = readFileSync(
    join(repoRoot, 'apps', 'api', 'src', 'modules', 'grievances', 'grievance-staff-roles.ts'),
    'utf8',
  );

  it('realm export defines municipality_* and tenant_clerk operator roles', () => {
    const realm = JSON.parse(realmJson) as { roles?: { realm?: Array<{ name: string }> } };
    const names = new Set((realm.roles?.realm ?? []).map((r) => r.name));
    for (const required of [
      'citizen',
      'tenant_clerk',
      'municipality_clerk',
      'municipality_admin',
      'tenant_admin',
      'state_admin',
    ]) {
      expect(names.has(required)).toBe(true);
    }
  });

  it('API GRIEVANCE_STAFF_ROLES includes Keycloak tenant_clerk alias', () => {
    expect(staffRolesSource).toContain("'tenant_clerk'");
    expect(staffRolesSource).toContain("'municipality_clerk'");
  });
});
