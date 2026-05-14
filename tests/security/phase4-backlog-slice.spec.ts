import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const grievancesSvc = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'grievances',
  'grievances.service.ts',
);
const citizenCtlPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'citizen',
  'citizen.controller.ts',
);
const publicCtlPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'grievances',
  'public-grievance-stats.controller.ts',
);

describe('Master Phase 4 backlog slice — contract fingerprints', () => {
  const serviceSrc = readFileSync(grievancesSvc, 'utf8');
  const citizenCtl = readFileSync(citizenCtlPath, 'utf8');
  const publicSrc = readFileSync(publicCtlPath, 'utf8');

  it('GrievancesService wires SLA breach notification + aggregates + attachments', () => {
    for (const marker of [
      `type: 'sla_breach'`,
      'registerCitizenAttachment',
      'getPublicAggregate',
    ]) {
      expect(serviceSrc).toContain(marker);
    }
  });

  it('exposes citizen notification inbox routes', () => {
    expect(citizenCtl).toContain(`@Get('notifications')`);
    expect(citizenCtl).toContain(`@Patch('notifications/:id/read')`);
  });

  it('exposes anonymised aggregate-metrics without JWT', () => {
    expect(publicSrc).toContain('@Public()');
    expect(publicSrc).toContain(`Controller('public/grievances')`);
    expect(publicSrc).toContain(`@Get('aggregate-metrics')`);
  });
});
