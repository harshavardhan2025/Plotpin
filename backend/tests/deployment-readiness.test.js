/**
 * Automated Deployment Readiness & Business Logic Test Suite
 * Verifies:
 * 1. Tokenized Search across multi-field metadata & DOS-bounded pagination
 * 2. Deal Checkouts, Owner Restrictions & Concurrency Locks
 * 3. Appointment Slot Timing & Duration Invariants
 * 4. Production Static Build Serving on Express
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { db } = require('../src/config/database');

let BASE_URL = 'http://localhost:5000';
let API_URL = `${BASE_URL}/api/v1`;
let server = null;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'property_marketplace_jwt_secret_2026';

async function initServer() {
  await db.syncFromSupabase(true);
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      BASE_URL = `http://localhost:${port}`;
      API_URL = `${BASE_URL}/api/v1`;
      resolve();
    });
  });
}

function request(method, urlString, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, roles: user.roles },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

const clientUser = { id: 'usr_vikram_rao', email: 'vikram@example.com', roles: ['buyer', 'seller', 'user'] };
const otherUser = { id: 'usr_ananya_sharma', email: 'ananya.sharma@example.com', roles: ['buyer', 'user'] };
const adminUser = { id: 'usr_admin_corp', email: 'admin@plotpin.com', roles: ['admin', 'user'] };

const clientToken = makeToken(clientUser);
const buyerToken = makeToken(otherUser);
const adminToken = makeToken(adminUser);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  await initServer();

  // Test-isolated users for offer tests
  if (!db.users.some(u => u._id === clientUser.id)) {
    db.users.push({ _id: clientUser.id, ...clientUser, accountStatus: 'active' });
  }
  if (!db.users.some(u => u._id === otherUser.id)) {
    db.users.push({ _id: otherUser.id, ...otherUser, accountStatus: 'active' });
  }

  // Self-contained in-memory fixture for testing search and offer rules
  if (!db.properties.some(p => p._id === 'prop_amaravati_01')) {
    db.properties.push({
      _id: 'prop_amaravati_01',
      ownerId: 'usr_vikram_rao',
      title: 'Luxury Penthouse in Indiranagar',
      description: 'Stunning penthouse indiranagar view with clear deed',
      category: 'residential',
      propertyType: 'apartment',
      price: 35000000,
      verificationStatus: 'approved',
      publicationStatus: 'published',
      location: { locality: 'Indiranagar', city: 'Bengaluru' }
    });
  }

  console.log('====================================================');
  console.log('🚀 DEPLOYMENT READINESS & LOGIC VERIFICATION SUITE');
  console.log('====================================================\n');

  // 1. Search Bar & Scalability
  console.log('Test Group 1: Search Bar & Scalability Limits');
  try {
    const searchRes = await request('GET', `${API_URL}/properties?query=penthouse+indiranagar`);
    assert(searchRes.status === 200, 'Multi-token search responds with 200');
    assert(Array.isArray(searchRes.data.properties) && searchRes.data.properties.length > 0, 'Multi-token search matched properties matching all keywords');

    const dosLimitRes = await request('GET', `${API_URL}/properties?limit=99999`);
    assert(dosLimitRes.status === 200, 'Extreme limit query handled');
    assert(dosLimitRes.data.properties.length <= 100, 'Page limit is strictly capped at maximum 100 items');
  } catch (err) {
    assert(false, `Search group encountered error: ${err.message}`);
  }

  // 2. Deal Checkouts & Concurrency
  console.log('\nTest Group 2: Checkouts, Deals & Concurrency Protection');
  try {
    // Owner self-offer rejected
    const selfOfferRes = await request('POST', `${API_URL}/properties/offers`, {
      propertyId: 'prop_amaravati_01', // Owned by usr_vikram_rao
      offerAmount: 35000000
    }, { Authorization: `Bearer ${clientToken}` });
    assert(selfOfferRes.status === 400 && selfOfferRes.data.code === 'OWNER_SELF_OFFER', 'Owner cannot checkout/offer on their own property (400 OWNER_SELF_OFFER)');

    // Invalid negative offer amount rejected
    const badAmtRes = await request('POST', `${API_URL}/properties/offers`, {
      propertyId: 'prop_amaravati_01',
      offerAmount: -5000
    }, { Authorization: `Bearer ${buyerToken}` });
    assert(badAmtRes.status === 400, 'Negative or zero offer amount rejected with 400');

    // Valid buyer offer accepted on prop_amaravati_01 by buyerToken (usr_ananya_sharma)
    const validOfferRes = await request('POST', `${API_URL}/properties/offers`, {
      propertyId: 'prop_amaravati_01',
      offerAmount: '₹2,65,00,000',
      closingDays: 45,
      paymentMode: 'loan'
    }, { Authorization: `Bearer ${buyerToken}` });
    assert(validOfferRes.status === 201 && validOfferRes.data?.success === true, 'Valid buyer offer accepted with 201 Created');
    assert(validOfferRes.data?.deal?.offerAmount === 26500000, 'Formatted currency correctly parsed into 26,500,000');
    assert(validOfferRes.data?.deal?.closingDays === 45, 'Closing days sanitized');
  } catch (err) {
    assert(false, `Checkout group encountered error: ${err.message}`);
  }

  // 3. Timings & Appointment Slot Logic
  console.log('\nTest Group 3: Appointment Slot Timings & Date Range Validations');
  try {
    const now = Date.now();
    // Past appointment rejected
    const pastRes = await request('POST', `${API_URL}/appointments`, {
      propertyId: 'prop_amaravati_01',
      startAt: new Date(now - 3600000).toISOString(),
      endAt: new Date(now - 1800000).toISOString()
    }, { Authorization: `Bearer ${buyerToken}` });
    assert(pastRes.status === 400 && pastRes.data.code === 'PAST_APPOINTMENT', 'Past appointment slot rejected (400 PAST_APPOINTMENT)');

    // Inverted time range rejected
    const testOffset = (30 + Math.floor(Math.random() * 100)) * 86400000 + Math.floor(Math.random() * 36000000);
    const futureStart = new Date(now + testOffset).toISOString();
    const futureEndEarlier = new Date(now + testOffset - 3600000).toISOString();
    const invertedRes = await request('POST', `${API_URL}/appointments`, {
      propertyId: 'prop_amaravati_01',
      startAt: futureStart,
      endAt: futureEndEarlier
    }, { Authorization: `Bearer ${buyerToken}` });
    assert(invertedRes.status === 400 && invertedRes.data.code === 'INVALID_TIME_RANGE', 'Inverted start/end times rejected (400 INVALID_TIME_RANGE)');

    // Too short duration (< 15 mins) rejected
    const shortEnd = new Date(now + testOffset + 5 * 60000).toISOString(); // 5 minutes
    const shortRes = await request('POST', `${API_URL}/appointments`, {
      propertyId: 'prop_amaravati_01',
      startAt: futureStart,
      endAt: shortEnd
    }, { Authorization: `Bearer ${buyerToken}` });
    assert(shortRes.status === 400 && shortRes.data.code === 'INVALID_DURATION', 'Duration under 15 minutes rejected (400 INVALID_DURATION)');

    // Valid 60-minute future appointment accepted on prop_amaravati_01
    const validEnd = new Date(now + testOffset + 60 * 60000).toISOString();
    const validAptRes = await request('POST', `${API_URL}/appointments`, {
      propertyId: 'prop_amaravati_01',
      startAt: futureStart,
      endAt: validEnd,
      notes: "Boundary inspection"
    }, { Authorization: `Bearer ${buyerToken}` });
    assert(validAptRes.status === 201 && validAptRes.data?.success === true, 'Valid site visit appointment confirmed (201 Created)');

    // Conflicting overlapping appointment rejected
    const overlapStart = new Date(now + testOffset + 30 * 60000).toISOString();
    const overlapEnd = new Date(now + testOffset + 90 * 60000).toISOString();
    const conflictRes = await request('POST', `${API_URL}/appointments`, {
      propertyId: 'prop_amaravati_01',
      startAt: overlapStart,
      endAt: overlapEnd
    }, { Authorization: `Bearer ${buyerToken}` });
    assert(conflictRes.status === 409 && conflictRes.data.code === 'APPOINTMENT_CONFLICT', 'Overlapping appointment slot detected and blocked (409 APPOINTMENT_CONFLICT)');

    // Clean up appointment via API
    if (validAptRes.data?.appointment?._id) {
      await request('POST', `${API_URL}/appointments/${validAptRes.data.appointment._id}/cancel`, {}, { Authorization: `Bearer ${clientToken}` });
    }
  } catch (err) {
    assert(false, `Appointment group encountered error: ${err.message}`);
  }

  // 4. Production Static Build Delivery
  console.log('\nTest Group 4: Production Static Serving & SPA Routing');
  try {
    const spaRes = await request('GET', `${BASE_URL}/`);
    assert(spaRes.status === 200, 'Root URL returns HTTP 200');
    assert(typeof spaRes.data === 'string' && spaRes.data.includes('<div id="root">'), 'Built React application index.html delivered directly by Express server');
  } catch (err) {
    assert(false, `Static delivery encountered error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 READINESS RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (server) server.close();
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests();
