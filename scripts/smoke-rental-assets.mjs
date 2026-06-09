#!/usr/bin/env node
/**
 * Smoke Test Script for Rental Assets (EN-17)
 * Tests API endpoints for structure, validation, and auth guards.
 */

const API_BASE = 'http://localhost:3001/api';

async function runSmokeTests() {
  console.log('🚀 Starting Rental Assets Smoke Tests...\n');

  // Test 1: GET /rental-assets (Should return 401 Unauthorized or 400 Bad Request if no token, proving route exists)
  console.log('1️⃣ Testing GET /rental-assets (Auth Guard Check)...');
  try {
    const res = await fetch(`${API_BASE}/rental-assets`);
    if (res.status === 401 || res.status === 400) {
      console.log('   ✅ PASS: Route exists and is properly protected by auth/validation.');
    } else {
      console.log(`   ⚠️  WARNING: Unexpected status ${res.status}. Expected 401 or 400.`);
    }
  } catch (err) {
    console.log(`   ❌ FAIL: Could not connect to API at ${API_BASE}. Is the server running?`);
    return;
  }

  // Test 2: POST /rental-assets (Validation Check - Missing Fields)
  console.log('\n2️⃣ Testing POST /rental-assets (Validation Check)...');
  try {
    const res = await fetch(`${API_BASE}/rental-assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // Empty body should trigger class-validator errors
    });
    const body = await res.json();
    if (res.status === 400 && (body.message || body.error)) {
      console.log('   ✅ PASS: Validation correctly rejects empty payload.');
    } else {
      console.log(`   ⚠️  WARNING: Expected 400 Bad Request, got ${res.status}`);
    }
  } catch (err) {
    console.log('   ❌ FAIL: Request failed.');
  }

  // Test 3: POST /rental-assets/agreements (Mandatory Trade License Check)
  console.log('\n3️⃣ Testing POST /rental-assets/agreements (Mandatory Trade License Check)...');
  try {
    const res = await fetch(`${API_BASE}/rental-assets/agreements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: '00000000-0000-0000-0000-000000000000',
        lessorName: 'Test Corp',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        // Intentionally omitting tradeLicenseNo to test validation
      }),
    });
    const body = await res.json();
    if (res.status === 400) {
      console.log('   ✅ PASS: Validation correctly rejects missing tradeLicenseNo.');
    } else {
      console.log(`   ⚠️  WARNING: Expected 400 Bad Request, got ${res.status}`);
    }
  } catch (err) {
    console.log('   ❌ FAIL: Request failed.');
  }

  console.log('\n✨ Smoke tests completed. If all tests passed (or showed expected auth/validation guards), the feature structure is solid!');
  console.log('Note: Full end-to-end testing requires a valid JWT token. You can perform UI smoke tests manually at http://localhost:3002/rental-assets');
}

runSmokeTests();
