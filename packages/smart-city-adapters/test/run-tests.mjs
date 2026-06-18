import assert from 'node:assert/strict';
import test from 'node:test';

import {
  StubEvMeterProvider,
  StubModbusSensorProvider,
  StubWaterMeterProvider,
} from '../dist/index.js';

test('kmc-pilot marks B01 and B02 occupied in ZONE-A', async () => {
  const provider = new StubModbusSensorProvider('kmc-pilot');
  const result = await provider.getZoneOccupancy('tenant-1', 'ZONE-A');
  assert.equal(result.bays.length, 20);
  assert.equal(result.bays.find((bay) => bay.code === 'B01')?.status, 'OCCUPIED');
  assert.equal(result.bays.find((bay) => bay.code === 'B02')?.status, 'OCCUPIED');
  assert.equal(result.bays.find((bay) => bay.code === 'B03')?.status, 'FREE');
});

test('all-free returns empty when zone is not configured', async () => {
  const provider = new StubModbusSensorProvider('all-free');
  const result = await provider.getZoneOccupancy('tenant-1', 'ZONE-A');
  assert.deepEqual(result.bays, []);
});

test('stub ev meter returns deterministic increment on stop', async () => {
  const meter = new StubEvMeterProvider(5.5);
  await meter.startMeter('session-1');
  assert.equal(await meter.readMeter('session-1'), 0);
  const consumed = await meter.stopMeter('session-1');
  assert.equal(consumed, 5.5);
  assert.equal(await meter.readMeter('session-1'), 5.5);
});

test('stub water meter lookup and recharge are deterministic', async () => {
  const meter = new StubWaterMeterProvider([
    {
      meterId: 'WM-001',
      balancePaise: 12500,
      lastReadingLitres: 182450,
      lastReadingAt: '2026-06-18T06:30:00.000Z',
    },
  ]);
  const before = await meter.lookup('WM-001');
  assert.equal(before?.balancePaise, 12500);
  const after = await meter.applyRecharge('WM-001', 50000);
  assert.equal(after.balancePaise, 62500);
  assert.equal((await meter.lookup('WM-001'))?.balancePaise, 62500);
});
