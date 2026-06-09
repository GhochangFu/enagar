#!/usr/bin/env node
/**
 * EN-18 sample-data seeder for smoke testing.
 *
 * - Picks the existing RENTED KMC asset (Stall 12, lessor EIIL)
 * - Sets lessorPhone so the citizen-pwa lookup works
 * - Inserts three sample invoices via the API and via direct prisma:
 *     1) PAID  (yesterday)        - for KPI "Collected"
 *     2) PENDING (today + 5d)     - for the "Due" pill
 *     3) OVERDUE (10d ago)        - for the "Overdue" pill + late fee
 *
 * Idempotent: re-running removes prior "en18-smoke" invoices first.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';

function loadInfraEnv() {
  const path = resolve(repoRoot, 'infrastructure/.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!k || k in process.env) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
loadInfraEnv();

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const KMC_CODE = 'KMC';
const ASSET_LABEL = 'Stall 12';
const LESSOR_NAME = 'EIIL';
const LESSOR_PHONE = '9876543210';
const TAG = 'en18-smoke';

async function kcToken(username) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-tenant',
    username,
    password: process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe',
  });
  const res = await fetch('http://localhost:8080/realms/enagar/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`kcToken ${username} ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { res, json, text };
}

function log(...args) { console.log('[en18-seed]', ...args); }
function fail(msg) { console.error('[en18-seed] FAIL:', msg); process.exit(1); }

async function main() {
  const token = await kcToken('kmc-municipality-admin-dummy');

  // 1) Find the KMC tenant + RENTED asset by inspecting API
  const { res: assetsRes, json: assets } = await api('GET', '/rental-assets', token);
  if (assetsRes.status !== 200) fail(`list assets ${assetsRes.status}: ${JSON.stringify(assets)}`);
  const tenant = await prisma.tenant.findUnique({ where: { code: KMC_CODE } });
  if (!tenant) fail('KMC tenant not seeded');

  const asset = assets.find((a) => a.status === 'RENTED' && a.assetType === 'MARKET_STALL')
    ?? assets.find((a) => a.status === 'RENTED');
  if (!asset) fail('No RENTED asset found in KMC');
  const lease = asset.agreements?.[0];
  if (!lease) fail('RENTED asset has no active lease');

  log('asset', asset.id, asset.name?.en);
  log('lease', lease.id, 'lessor=', lease.lessorName, 'rate=', asset.baseLeaseRatePaise, 'period=', asset.ratePeriod);

  // 2) Update lessor phone
  if (!lease.lessorPhone) {
    const upd = await prisma.leaseAgreement.update({
      where: { id: lease.id },
      data: { lessorPhone: LESSOR_PHONE },
    });
    log('updated lessorPhone to', upd.lessorPhone);
  } else {
    log('lessorPhone already set:', lease.lessorPhone);
  }

  // 3) Wipe any prior smoke-tagged invoices on this lease (idempotent)
  const prior = await prisma.leaseInvoice.findMany({
    where: { agreementId: lease.id, invoiceNo: { startsWith: `${TAG}-` } },
  });
  for (const inv of prior) {
    log('removing prior invoice', inv.invoiceNo, inv.id);
    // Delete any linked payments first (target_check constraint requires exactly one
    // target; cascade behavior may not be configured for our seed rows).
    await prisma.receipt.deleteMany({ where: { leaseInvoiceId: inv.id } });
    await prisma.payment.deleteMany({ where: { leaseInvoiceId: inv.id } });
    await prisma.leaseInvoice.delete({ where: { id: inv.id } });
  }
  if (prior.length) log(`removed ${prior.length} prior ${TAG} invoice(s)`);

  // 4) Insert three sample invoices
  const day = 24 * 60 * 60 * 1000;
  const now = new Date();
  const ratePaise = asset.baseLeaseRatePaise;
  const samples = [
    {
      tag: `${TAG}-PAID-1`,
      periodStart: new Date(now.getTime() - 35 * day),
      periodEnd: new Date(now.getTime() - 5 * day),
      dueDate: new Date(now.getTime() - 5 * day),
      amountPaise: ratePaise,
      lateFeePaise: 0,
      status: 'PAID',
    },
    {
      tag: `${TAG}-DUE-1`,
      periodStart: new Date(now.getTime() - 4 * day),
      periodEnd: new Date(now.getTime() + 26 * day),
      dueDate: new Date(now.getTime() + 5 * day),
      amountPaise: ratePaise,
      lateFeePaise: 0,
      status: 'PENDING',
    },
    {
      tag: `${TAG}-OVERDUE-1`,
      periodStart: new Date(now.getTime() - 64 * day),
      periodEnd: new Date(now.getTime() - 34 * day),
      dueDate: new Date(now.getTime() - 10 * day),
      amountPaise: ratePaise,
      lateFeePaise: 50000, // ₹500
      status: 'OVERDUE',
    },
  ];
  const created = [];
  for (const s of samples) {
    const row = await prisma.leaseInvoice.create({
      data: {
        tenantId: tenant.id,
        agreementId: lease.id,
        invoiceNo: s.tag,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        dueDate: s.dueDate,
        amountPaise: s.amountPaise,
        lateFeePaise: s.lateFeePaise,
        status: s.status,
      },
    });
    created.push(row);
    log(`created ${row.invoiceNo} status=${row.status} amountPaise=${row.amountPaise} lateFeePaise=${row.lateFeePaise} dueDate=${row.dueDate.toISOString()}`);
  }

  // 5) Print overview
  log('=== OVERVIEW ===');
  log(`Tenant:    ${tenant.code} (${tenant.name})`);
  log(`Asset:     ${asset.name?.en} [${asset.status}]`);
  log(`Lessor:    ${lease.lessorName}  phone=${LESSOR_PHONE}`);
  log(`Lease:     ${lease.id}  tradeLicense=${lease.tradeLicenseNo}`);
  log(`Base rate: ₹${ratePaise / 100} / ${asset.ratePeriod}`);
  log(`Invoices created: ${created.length}`);
  for (const inv of created) {
    const total = inv.amountPaise + inv.lateFeePaise;
    log(`  - ${inv.invoiceNo.padEnd(28)} ${inv.status.padEnd(8)} due=${inv.dueDate.toISOString().slice(0,10)}  total=₹${total / 100}`);
  }
  log('');
  log('Smoke flow ready. Open http://localhost:3002/rental-assets (admin) and the citizen /leases page.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
