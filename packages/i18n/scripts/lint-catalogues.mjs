import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(scriptDir, '..', 'src', 'index.ts'), 'utf8');
const supportedLocales = Array.from(source.matchAll(/export type Locale = ([^;]+);/g))[0][1]
  .split('|')
  .map((locale) => locale.replace(/['\s]/g, ''))
  .filter(Boolean);

const catalogues = new Map();

for (const locale of supportedLocales) {
  const localeBlock = source.match(new RegExp(`\\n  ${locale}: \\{([\\s\\S]*?)\\n  \\}`, 'm'));
  if (!localeBlock) {
    throw new Error(`Catalogue block for locale ${locale} not found.`);
  }

  catalogues.set(
    locale,
    Array.from(localeBlock[1].matchAll(/'([^']+)':/g))
      .map(([, key]) => key)
      .sort(),
  );
}

const [defaultLocale] = supportedLocales;
const defaultKeys = catalogues.get(defaultLocale);
const failures = [];

for (const locale of supportedLocales) {
  const keys = catalogues.get(locale);
  const missing = defaultKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !defaultKeys.includes(key));

  if (missing.length > 0) {
    failures.push(`${locale}: missing keys: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    failures.push(`${locale}: extra keys: ${extra.join(', ')}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.info(
  `i18n catalogue lint passed (${defaultKeys.length} keys x ${supportedLocales.length} locales).`,
);
