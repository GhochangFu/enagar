import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const seedPath = join(repoRoot, '..', 'infrastructure', 'seed', 'tenants', 'tenant-seeds.json');
const allowedLanguages = new Set(['en', 'bn', 'hi']);

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const tenant = {
  code: requireArg(args, 'code').toUpperCase(),
  name: requireArg(args, 'name'),
  district: requireArg(args, 'district'),
  ward_count: Number(requireArg(args, 'wards')),
  theme_color: args.theme ?? '#0F4C75',
  languages_enabled: (args.languages ?? 'en,bn,hi').split(',').map((language) => language.trim()),
};

validateTenant(tenant);

const tenants = JSON.parse(readFileSync(seedPath, 'utf8'));
const existingIndex = tenants.findIndex((candidate) => candidate.code === tenant.code);

if (existingIndex >= 0) {
  tenants[existingIndex] = tenant;
} else {
  tenants.push(tenant);
}

tenants.sort((left, right) => left.code.localeCompare(right.code));
writeFileSync(seedPath, `${JSON.stringify(tenants, null, 2)}\n`);

console.info(`${existingIndex >= 0 ? 'Updated' : 'Added'} tenant ${tenant.code} in ${seedPath}`);
console.info(
  `SQL upsert preview: INSERT INTO tenants (code, name, district, ward_count, theme_color, languages_enabled) VALUES ('${tenant.code}', '${escapeSql(tenant.name)}', '${escapeSql(tenant.district)}', ${tenant.ward_count}, '${tenant.theme_color}', ARRAY[${tenant.languages_enabled.map((language) => `'${language}'`).join(', ')}]) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, district = EXCLUDED.district, ward_count = EXCLUDED.ward_count, theme_color = EXCLUDED.theme_color, languages_enabled = EXCLUDED.languages_enabled;`,
);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    if (key === 'help') {
      parsed.help = true;
      continue;
    }
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function requireArg(args, key) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing required argument --${key}. Run pnpm seed:tenant -- --help.`);
  }
  return value;
}

function validateTenant(tenant) {
  if (!/^[A-Z0-9]{2,10}$/.test(tenant.code)) {
    throw new Error('--code must be 2-10 uppercase letters/numbers.');
  }
  if (!Number.isInteger(tenant.ward_count) || tenant.ward_count < 1) {
    throw new Error('--wards must be a positive integer.');
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(tenant.theme_color)) {
    throw new Error('--theme must be a hex colour like #0F4C75.');
  }
  for (const language of tenant.languages_enabled) {
    if (!allowedLanguages.has(language)) {
      throw new Error(`Unsupported language ${language}; allowed: en,bn,hi.`);
    }
  }
}

function escapeSql(value) {
  return value.replaceAll("'", "''");
}

function printHelp() {
  console.info(`Usage:
pnpm seed:tenant -- --code KMC --name "Kolkata Municipal Corporation" --district Kolkata --wards 144 --theme "#0F4C75" --languages en,bn,hi

Updates infrastructure/seed/tenants/tenant-seeds.json (catalog for tooling) and prints a SQL upsert preview.
To sync tenants into Postgres, use fixed UUIDs in src/modules/tenants/tenant.seed.ts and run: pnpm db:seed`);
}
