import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const pagePath = join(repoRoot, 'apps', 'citizen-pwa', 'app', 'page.tsx');
const workspacePath = join(
  repoRoot,
  'apps',
  'citizen-pwa',
  'components',
  'grievances-workspace.tsx',
);

describe('Sprint 4.2 grievance PWA contract', () => {
  const page = readFileSync(pagePath, 'utf8');
  const workspace = readFileSync(workspacePath, 'utf8');
  const combined = `${page}\n${workspace}`;

  it('wires citizen workspace tab to grievances API client', () => {
    for (const snippet of [
      "import { GrievancesWorkspace } from '../components/grievances-workspace'",
      "activeTab === 'grievances'",
      '`${apiBaseUrl}/grievances`',
      '`${apiBaseUrl}/grievances/${encodeURIComponent',
    ]) {
      expect(combined).toContain(snippet);
    }
    expect(page).toContain('onGrievancesMutated');
  });

  it('declares category codes aligned with seeded grievance SLA examples', () => {
    expect(workspace).toContain('@enagar/grievance-catalogue');
    expect(workspace).toContain('categoryLabelFromCatalogue');
    expect(workspace).toContain('/citizen/register');
    expect(workspace).toContain('/citizen/profile');
  });
});
