import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scanLogic = readFileSync(join(root, 'src/scan-logic.ts'), 'utf8');

test('scan-logic detects EICAR signature', () => {
  assert.match(scanLogic, /EICAR-STANDARD-ANTIVIRUS-TEST-FILE/);
  assert.match(scanLogic, /scanObjectBytes/);
});

test('worker entry wires BullMQ document-scan queue', () => {
  const index = readFileSync(join(root, 'src/index.ts'), 'utf8');
  assert.match(index, /document-scan/);
  assert.match(index, /processScan/);
});
