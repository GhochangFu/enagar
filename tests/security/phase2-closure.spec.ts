import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const add77thServiceSqlPath = join(repoRoot, 'docs', 'sql', 'phase2-add-77th-service.sql');
const serviceSeedPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'services',
  'service-catalogue.seed.ts',
);
const pwaPagePath = join(repoRoot, 'apps', 'citizen-pwa', 'app', 'page.tsx');

describe('Phase 2 closure exit-criteria contract', () => {
  const add77thServiceSql = readFileSync(add77thServiceSqlPath, 'utf8').toLowerCase();
  const serviceSeed = readFileSync(serviceSeedPath, 'utf8');
  const pwaPage = readFileSync(pwaPagePath, 'utf8');

  it('records exact SQL for adding a 77th service through database inserts only', () => {
    expect(add77thServiceSql).toContain('begin;');
    expect(add77thServiceSql).toContain('commit;');
    expect(add77thServiceSql).toContain('insert into global_services');
    expect(add77thServiceSql).toContain('insert into services');
    expect(add77thServiceSql).toContain('insert into service_form_versions');
    expect(add77thServiceSql).toContain("'water-connection'");
    expect(add77thServiceSql).not.toContain('select *');
  });

  it('keeps the 77th service out of TypeScript seed data', () => {
    expect(serviceSeed).not.toContain('water-connection');
  });

  it('orders the citizen PWA flow as draft, document upload, then submit', () => {
    const draftIndex = pwaPage.indexOf('draftResponse');
    const uploadIndex = pwaPage.indexOf('createDocumentIntents(draft, selectedSchema)');
    const submitDraftIndex = pwaPage.indexOf('submitResponse');

    expect(draftIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(draftIndex);
    expect(submitDraftIndex).toBeGreaterThan(uploadIndex);
  });
});
