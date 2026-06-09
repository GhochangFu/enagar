import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const infraEnv = resolve(repoRoot, 'infrastructure/.env');
if (existsSync(infraEnv)) {
  for (const line of readFileSync(infraEnv, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!k || k in process.env) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Fetch only the citizenId we care about, then check the runtime snapshot via raw SQL
const cs = await prisma.citizen.findMany({ where: { mobile: '9836177767' }, select: { id: true } });
const ids = cs.map(c => c.id);

// Use raw SQL to get just the subject + tenant_code from the JSONB snapshot
const rows = await prisma.$queryRawUnsafe(
  `SELECT docket_no, status,
          runtime_snapshot->>'citizen_subject' AS citizen_subject,
          runtime_snapshot->>'tenant_code' AS tenant_code
   FROM applications
   WHERE citizen_id = ANY($1::uuid[])
   ORDER BY submitted_at DESC`,
  ids,
);
console.log('rows:', rows.length);
let withSubj = 0, withoutSubj = 0;
let withSubjMatch = 0, withSubjMismatch = 0;
for (const r of rows) {
  if (r.citizen_subject) withSubj++;
  else withoutSubj++;
  if (r.citizen_subject === 'dev-citizen-9836177767') withSubjMatch++;
  else if (r.citizen_subject) withSubjMismatch++;
}
console.log('with citizen_subject populated:', withSubj);
console.log('without citizen_subject (null):', withoutSubj);
console.log('matching dev-citizen-9836177767:', withSubjMatch);
console.log('mismatch (different subject):', withSubjMismatch);
console.log();
console.log('Sample rows:');
for (const r of rows.slice(0, 8)) {
  console.log(' ', r.docket_no.padEnd(40), 'status=', r.status.padEnd(10), 'subject=', r.citizen_subject, 'tenant_code=', r.tenant_code);
}
await prisma.$disconnect();
