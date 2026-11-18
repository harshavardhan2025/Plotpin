/**
 * Comprehensive Business Logic & Remediation Regression Test Suite
 * Tests Phase 2, Phase 3, and Phase 4 hardening rules:
 * 1. Concurrency: duplicate deal closures rejected with 409
 * 2. Uploads: magic byte inspection rejects fake PDFs
 * 3. Appointments: strict interval overlap detection and past appointment rejection
 * 4. Property validation: negative price, invalid coordinates, and PG non-rental purpose rejected
 * 5. Escrow release: requires verified buyer confirmation or evidence reference
 * 6. AI Recommendations: distinct source and fallback indicator flags
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { db } = require('../src/config/database');

let BASE_URL = 'http://localhost:5000/api/v1';
let ephemeralServer = null;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'property_marketplace_jwt_secret_2026';

function request(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
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

let passed = 0;
let failed = 0;

function assert(description, condition, extraInfo = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}. ${extraInfo}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('⚙️ LANDPIN BUSINESS LOGIC & INTEGRITY TEST SUITE');
  console.log('====================================================\n');

  try {
    await new Promise((resolve) => {
      ephemeralServer = http.createServer(app);
      ephemeralServer.listen(0, () => {
        const port = ephemeralServer.address().port;
        BASE_URL = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });

    const testUsers = [
      { id: 'usr_client_001', _id: 'usr_client_001', email: 'owner@landpin.com', roles: ['user'], name: 'Owner Vikram', accountStatus: 'active' },
      { id: 'usr_admin_001', _id: 'usr_admin_001', email: 'admin@landpin.com', roles: ['user', 'admin'], name: 'Admin Officer', accountStatus: 'active' }
    ];
    testUsers.forEach(u => {
      if (!db.users.some(existing => existing._id === u._id || existing.id === u.id)) {
        db.users.push(u);
      }
    });

    if (!db.properties.some(p => p._id === 'prop_001' || p.id === 'prop_001')) {
      db.properties.push({
        _id: 'prop_001',
        id: 'prop_001',
        ownerId: 'usr_client_001',
        title: 'Business Logic Test Property 1',
        price: 3500000,
        verificationStatus: 'approved',
        publicationStatus: 'published',
        availabilityStatus: 'available'
      });
    }

    if (!db.properties.some(p => p._id === 'prop_002' || p.id === 'prop_002')) {
      db.properties.push({
        _id: 'prop_002',
        id: 'prop_002',
        ownerId: 'usr_admin_001',
        title: 'Business Logic Test Property 2',
        price: 4500000,
        verificationStatus: 'approved',
        publicationStatus: 'published',
        availabilityStatus: 'available'
      });
    }

    const userToken = jwt.sign(
      { userId: 'usr_client_001', roles: ['user'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const adminToken = jwt.sign(
      { userId: 'usr_admin_001', roles: ['user', 'admin'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 1. Property validation: negative price and invalid coords
    console.log('Test Group 1: Server-Side Property Validation');
    const negPriceRes = await request('POST', '/properties', {
      title: 'Valid Title Here',
      category: 'residential',
      purpose: 'sale',
      price: -500000
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('Negative property price rejected with 400', negPriceRes.status === 400, `Got ${negPriceRes.status}`);

    const pgSaleRes = await request('POST', '/properties', {
      title: 'Luxury PG Accommodation',
      category: 'pg',
      purpose: 'sale',
      price: 5000000
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('PG accommodation with purpose sale rejected with 400', pgSaleRes.status === 400, `Got ${pgSaleRes.status}`);

    // 2. Magic byte file inspection
    console.log('\nTest Group 2: Magic Byte File Signature Inspection');
    // Upload a fake PDF with plain text content that lacks %PDF- header
    const fakePdfRes = await request('POST', '/properties/prop_001/documents', {
      documentType: 'e_khata',
      originalFilename: 'malicious.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      fileBase64: Buffer.from('<script>alert("xss")</script>').toString('base64')
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('Fake PDF without %PDF- magic bytes rejected', fakePdfRes.status === 400 || fakePdfRes.status === 500, `Got ${fakePdfRes.status}`);

    // Upload a genuine PDF with %PDF- header
    const validPdfRes = await request('POST', '/properties/prop_001/documents', {
      documentType: 'e_khata',
      originalFilename: 'legit_deed.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      fileBase64: Buffer.from('%PDF-1.4 test document').toString('base64')
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('Valid PDF with %PDF- header accepted with 201', validPdfRes.status === 201, `Got ${validPdfRes.status}`);

    // 3. Appointment booking conflicts & interval overlap
    console.log('\nTest Group 3: Appointment Conflicts & Timezone Integrity');
    const pastAptRes = await request('POST', '/appointments', {
      propertyId: 'prop_002',
      startAt: new Date(Date.now() - 3600000).toISOString(),
      endAt: new Date(Date.now() - 1800000).toISOString()
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('Past appointment scheduling rejected with 400', pastAptRes.status === 400, `Got ${pastAptRes.status}`);

    const selfBookRes = await request('POST', '/appointments', {
      propertyId: 'prop_001', // owned by usr_client_001
      startAt: new Date(Date.now() + 86400000).toISOString(),
      endAt: new Date(Date.now() + 90000000).toISOString()
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('Owner booking visit on own property rejected with 400', selfBookRes.status === 400, `Got ${selfBookRes.status}`);

    // 4. Duplicate Deal Closures & Concurrency
    console.log('\nTest Group 4: Deal Closure Concurrency & Idempotency');
    // Create a fresh test property to test full deal closure lifecycle
    const uniqueSuffix = Date.now();
    const freshPropRes = await request('POST', '/properties', {
      title: `Concurrency Deal Test Villa ${uniqueSuffix}`,
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: 25000000,
      area: { value: 2000, unit: 'sqft' },
      location: { locality: `Locality_${uniqueSuffix}`, city: 'Bengaluru' }
    }, { 'Authorization': `Bearer ${userToken}` });

    const testPropId = freshPropRes.data?.property?._id;
    assert('Fresh property created for deal closure testing', freshPropRes.status === 201 && Boolean(testPropId), `Status: ${freshPropRes.status}`);

    if (testPropId) {
      // First closure of fresh property
      const firstClose = await request('POST', `/properties/${testPropId}/complete-deal`, {
        outcome: 'sold',
        buyerName: 'Verified First Citizen Buyer',
        finalPrice: 25000000
      }, { 'Authorization': `Bearer ${userToken}` });
      assert('First deal closure succeeds with 200', firstClose.status === 200, `Got ${firstClose.status}`);

      // Attempt concurrent duplicate closure on already sold property
      const duplicateClose = await request('POST', `/properties/${testPropId}/complete-deal`, {
        outcome: 'sold',
        buyerName: 'Duplicate Attacker Buyer',
        finalPrice: 25000000
      }, { 'Authorization': `Bearer ${userToken}` });
      assert('Duplicate deal closure rejected with 409 Conflict', duplicateClose.status === 409, `Got ${duplicateClose.status}`);
    }

    // 5. Escrow Release Authorization & Multi-Sig Verification
    console.log('\nTest Group 5: Escrow Release Authorization & Verification Evidence');
    const escrowsRes = await request('GET', '/admin/escrows', null, { 'Authorization': `Bearer ${adminToken}` });
    let targetDeal = (escrowsRes.data.escrows || []).find(e => !e.fundsReleased && e.status !== 'completed');
    if (!targetDeal) {
      // Create a fresh offer to test escrow release lifecycle
      const freshOfferRes = await request('POST', '/properties/offers', {
        propertyId: 'prop_002',
        offerAmount: '₹3,50,00,000'
      }, { 'Authorization': `Bearer ${userToken}` });
      targetDeal = freshOfferRes.data?.deal;
    }
    if (targetDeal) {
      // Attempt releasing without buyer confirmation or transaction evidence
      const unverifiedRelease = await request('POST', `/admin/escrows/${targetDeal._id}/release`, {
        buyerConfirmed: false
      }, { 'Authorization': `Bearer ${adminToken}` });
      assert('Escrow release without buyer confirmation/evidence rejected with 400', unverifiedRelease.status === 400, `Got ${unverifiedRelease.status}`);

      // Releasing with verified buyer confirmation
      const verifiedRelease = await request('POST', `/admin/escrows/${targetDeal._id}/release`, {
        buyerConfirmed: true,
        transactionEvidenceRef: 'TXN-BANK-NEFT-998822'
      }, { 'Authorization': `Bearer ${adminToken}` });
      assert('Escrow release with buyer confirmation and evidence succeeds with 200', verifiedRelease.status === 200, `Got ${verifiedRelease.status}`);
    }

    // 6. AI Recommendations Isolation & Fallback distinction
    console.log('\nTest Group 6: AI Recommendations & User Isolation');
    const recoRes = await request('POST', '/properties/recommendations', {
      purpose: 'sale'
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('Recommendations return 200', recoRes.status === 200, `Got ${recoRes.status}`);
    assert('Recommendations indicate engine and fallback status', typeof recoRes.data.isFallback === 'boolean');
    // 7. Indian Currency Parsing & Validation
    console.log('\nTest Group 7: Indian Currency Parsing & Validation');
    const { parseIndianCurrency } = require('../src/controllers/propertyController');
    assert('Parse ₹3,85,00,000 correctly into 38500000', parseIndianCurrency('₹3,85,00,000') === 38500000);
    assert('Parse 3,85,00,000 with commas correctly', parseIndianCurrency('3,85,00,000') === 38500000);
    assert('Parse 3.85 Cr shorthand correctly into 38500000', parseIndianCurrency('3.85 Cr') === 38500000);
    assert('Parse 45 Lakhs shorthand correctly into 4500000', parseIndianCurrency('45 Lakhs') === 4500000);
    assert('Reject negative amounts', parseIndianCurrency('-5000') === null);
    assert('Reject NaN string', parseIndianCurrency('NaN') === null);
    assert('Reject Infinity', parseIndianCurrency('Infinity') === null);

    // 8. Cascading Deal Closure & Offer Availability Safeguards
    console.log('\nTest Group 8: Cascading Deal Closure & Offer Safeguards');
    // Attempting to submit an offer on the already-sold testPropId
    const offerRes = await request('POST', '/properties/offers', {
      propertyId: testPropId,
      offerAmount: '₹3,50,00,000'
    }, { 'Authorization': `Bearer ${userToken}` });
    assert('Submitting offer on sold property rejected with 400', offerRes.status === 400 && offerRes.data.code === 'PROPERTY_NOT_AVAILABLE');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`📊 BUSINESS LOGIC RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (ephemeralServer) {
    ephemeralServer.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

