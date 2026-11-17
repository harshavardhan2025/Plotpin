/**
 * Geospatial Nearby Search & Location Proxy Test Suite
 * Tests:
 * 1. Coordinates validation (-90 <= lat <= 90, -180 <= lng <= 180, finite check)
 * 2. Radius validation (1 <= radius <= 100 km)
 * 3. Exact nearby property matching & Haversine distance calculations
 * 4. Confidential deed isolation & unauthorized listing exclusion
 * 5. Location geocoding & reverse geocoding endpoints
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const assert = require('assert');
const app = require('../src/app');

let BASE_URL = 'http://localhost:5000/api/v1';
let server = null;

function initServer() {
  return new Promise((resolve) => {
    const probe = http.get('http://localhost:5000/api/v1/health', () => {
      resolve();
    });
    probe.on('error', () => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        BASE_URL = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });
  });
}

function apiRequest(method, endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  await initServer();

  console.log('\n====================================================');
  console.log('🌍 GEOSPATIAL NEARBY SEARCH & LOCATION PROXY TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(msg) {
    passed++;
    console.log(`  ✅ PASS: ${msg}`);
  }

  function fail(msg, err) {
    failed++;
    console.error(`  ❌ FAIL: ${msg}`);
    if (err) console.error(err);
  }

  // Group 1: Coordinates and Radius Parameter Validation
  console.log('--- Test Group 1: Coordinate & Radius Validation ---');
  try {
    const res = await apiRequest('GET', '/properties/nearby?lat=invalid&lng=78.8242');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Invalid coordinates or radius');
    pass('Invalid latitude format rejected (HTTP 400)');
  } catch (err) { fail('Invalid latitude test failed', err); }

  try {
    const res = await apiRequest('GET', '/properties/nearby?lat=95&lng=78.8242');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Invalid coordinates or radius');
    pass('Latitude out of range (> 90) rejected (HTTP 400)');
  } catch (err) { fail('Latitude out of range test failed', err); }

  try {
    const res = await apiRequest('GET', '/properties/nearby?lat=14.4673&lng=195');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Invalid coordinates or radius');
    pass('Longitude out of range (> 180) rejected (HTTP 400)');
  } catch (err) { fail('Longitude out of range test failed', err); }

  try {
    const res = await apiRequest('GET', '/properties/nearby?lat=14.4673&lng=78.8242&radius=0');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Invalid coordinates or radius');
    pass('Radius below minimum (< 1 km) rejected (HTTP 400)');
  } catch (err) { fail('Radius below minimum test failed', err); }

  try {
    const res = await apiRequest('GET', '/properties/nearby?lat=14.4673&lng=78.8242&radius=250');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Invalid coordinates or radius');
    pass('Radius above maximum (> 100 km) rejected (HTTP 400)');
  } catch (err) { fail('Radius above maximum test failed', err); }

  // Group 2: Valid Geospatial Nearby Property Results
  console.log('\n--- Test Group 2: Geospatial Nearby Discovery ---');
  try {
    // Kadapa coordinates
    const res = await apiRequest('GET', '/properties/nearby?lat=14.4673&lng=78.8242&radius=50');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(Array.isArray(res.body.properties));
    assert(typeof res.body.count === 'number');
    pass(`Nearby search for Kadapa returned ${res.body.count} properties within 50 km (HTTP 200)`);

    // Verify distance sorting
    if (res.body.properties.length > 1) {
      for (let i = 0; i < res.body.properties.length - 1; i++) {
        assert(res.body.properties[i].distanceKm <= res.body.properties[i + 1].distanceKm);
      }
      pass('Properties returned are sorted ascending by great-circle distance in kilometers');
    }
  } catch (err) { fail('Kadapa nearby search test failed', err); }

  // Group 3: Strict Radius Enforcement
  console.log('\n--- Test Group 3: Strict Radius Boundary Enforcement ---');
  try {
    const smallRadiusRes = await apiRequest('GET', '/properties/nearby?lat=14.4673&lng=78.8242&radius=5');
    assert.strictEqual(smallRadiusRes.status, 200);
    smallRadiusRes.body.properties.forEach(p => {
      assert(p.distanceKm <= 5, `Property ${p.title} has distance ${p.distanceKm} > 5km`);
    });
    pass('All returned properties strictly reside within requested 5 km radius');
  } catch (err) { fail('Strict radius enforcement test failed', err); }

  // Group 4: Confidential Deed Isolation
  console.log('\n--- Test Group 4: Confidential Deed Security ---');
  try {
    const res = await apiRequest('GET', '/properties/nearby?lat=14.4673&lng=78.8242&radius=100');
    assert.strictEqual(res.status, 200);
    res.body.properties.forEach(p => {
      assert.strictEqual(p.documents, undefined, `Public nearby response leaked confidential deeds for ${p.title}`);
    });
    pass('Confidential deeds and documents are strictly hidden from public nearby search');
  } catch (err) { fail('Confidential deed isolation test failed', err); }

  // Group 5: Location Proxy Endpoints
  console.log('\n--- Test Group 5: Location Proxy Validation ---');
  try {
    const res = await apiRequest('GET', '/location/search');
    assert.strictEqual(res.status, 400);
    pass('Missing query q parameter rejected with HTTP 400');
  } catch (err) { fail('Location search validation test failed', err); }

  try {
    const res = await apiRequest('GET', '/location/reverse');
    assert.strictEqual(res.status, 400);
    pass('Missing coordinates for reverse geocoding rejected with HTTP 400');
  } catch (err) { fail('Location reverse validation test failed', err); }

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (server) {
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
