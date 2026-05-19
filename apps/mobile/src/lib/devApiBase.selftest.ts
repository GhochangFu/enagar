import assert from 'node:assert/strict';

import { hostFromMetroUri, rewriteLocalhostApiBase } from './apiBaseUrl';

assert.strictEqual(
  rewriteLocalhostApiBase('http://localhost:3001/api', '192.168.1.8'),
  'http://192.168.1.8:3001/api',
);
assert.strictEqual(
  rewriteLocalhostApiBase('http://127.0.0.1:3001/api/', '10.0.2.2'),
  'http://10.0.2.2:3001/api',
);
assert.strictEqual(
  rewriteLocalhostApiBase('http://192.168.1.8:3001/api', '192.168.1.9'),
  'http://192.168.1.8:3001/api',
);
assert.strictEqual(hostFromMetroUri('192.168.1.8:8081'), '192.168.1.8');
assert.strictEqual(hostFromMetroUri('localhost:8081'), null);

console.info('devApiBase.selftest: ok');
