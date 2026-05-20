import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workspacePath = join(__dirname, '..', 'components', 'grievances-workspace.tsx');

describe('grievances-workspace filing catalogue', () => {
  it('does not export a static grievance category enum for filing', () => {
    const source = readFileSync(workspacePath, 'utf8');
    expect(source).not.toMatch(/export const GRIEVANCE_CATEGORY_CODES/);
    expect(source).toContain('fetchPublicGrievanceCatalogue');
  });
});
