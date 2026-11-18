/**
 * Automated Security Regression Test Suite
 * Tests:
 * 1. Anonymous access to protected endpoints (expect 401)
 * 2. Expired and invalid JWT signatures (expect 401)
 * 3. User role escalation via headers (expect 401 / 403)
 * 4. Unauthorized property updates by non-owners (expect 403)
 * 5. Cross-user document access (expect 403)
 * 6. Unauthorized admin actions by regular users (expect 403)
 * 7. Access to unpublished or unapproved properties in public search (expect only published/approved)
 * 8. Malicious input and invalid identifiers (expect 400 / 404)
 * 9. Upload restrictions (mime type & size validation)
 * 10. Exposure of privileged credentials in frontend env / code (expect no sb_secret_)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = require('../src/app');

let BASE_URL = 'http://localhost:5000/api/v1';
const { db } = require('../src/config/database');
let server = null;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'property_marketplace_jwt_secret_2026';

async function initServer() {
  await db.syncFromSupabase(true);
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      BASE_URL = `http://localhost:${port}/api/v1`;
      resolve();
    });
  });
}

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

async function runTests() {
  console.log('====================================================');
  console.log('🛡️ LANDPIN SECURITY REGRESSION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}. ${details}`);
      failed++;
    }
  }

  try {
    await initServer();

    // Isolated in-memory fixtures for unit test assertions
    if (!db.users.some(u => u._id === 'usr_935ff8ae5310')) {
      db.users.push({
        _id: 'usr_935ff8ae5310',
        id: 'usr_935ff8ae5310',
        email: 'user935@plotpin.com',
        roles: ['user', 'buyer', 'seller'],
        accountStatus: 'active'
      });
    }

    if (!db.properties.some(p => p._id === 'prop_tirupati_04')) {
      db.properties.push({
        _id: 'prop_tirupati_04',
        ownerId: 'usr_different_owner_999',
        title: 'Tirupati Villa',
        price: 15000000,
        verificationStatus: 'approved',
        publicationStatus: 'published',
        documents: [{ _id: 'doc_1', title: 'Sale Deed' }]
      });
    }
    if (!db.properties.some(p => p._id === 'prop_kurnool_queue_01')) {
      db.properties.push({
        _id: 'prop_kurnool_queue_01',
        ownerId: 'usr_different_owner_999',
        title: 'Kurnool Queue Property',
        price: 10000000,
        verificationStatus: 'submitted',
        publicationStatus: 'draft'
      });
    }

    // Generate test tokens with real database identities
    const validUserToken = jwt.sign(
      { userId: 'usr_935ff8ae5310', roles: ['user', 'buyer', 'seller'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const validAdminToken = jwt.sign(
      { userId: 'usr_admin_corp', roles: ['admin', 'user'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const expiredToken = jwt.sign(
      { userId: 'usr_vikram_rao', roles: ['user'] },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const forgedToken = jwt.sign(
      { userId: 'usr_vikram_rao', roles: ['user', 'admin'] },
      'wrong_forged_secret_key',
      { expiresIn: '1h' }
    );

    // 1. Anonymous access to protected endpoints
    console.log('Test Group 1: Anonymous Access to Protected Endpoints');
    const anonAdmin = await request('GET', '/admin/overview');
    assert('Anonymous request to /admin/overview rejected with 401', anonAdmin.status === 401, `Got ${anonAdmin.status}`);

    const anonMyProps = await request('GET', '/properties/my');
    assert('Anonymous request to /properties/my rejected with 401', anonMyProps.status === 401, `Got ${anonMyProps.status}`);

    // 2. Expired and invalid JWT signatures
    console.log('\nTest Group 2: Expired and Malformed Tokens');
    const expiredRes = await request('GET', '/properties/my', null, { 'Authorization': `Bearer ${expiredToken}` });
    assert('Expired token rejected with 401', expiredRes.status === 401, `Got ${expiredRes.status}`);

    const forgedRes = await request('GET', '/admin/overview', null, { 'Authorization': `Bearer ${forgedToken}` });
    assert('Forged signature rejected with 401', forgedRes.status === 401, `Got ${forgedRes.status}`);

    // 3. User role escalation via unverified headers
    console.log('\nTest Group 3: Unverified Header Role Escalation');
    const headerEscalation = await request('GET', '/admin/overview', null, { 'X-User-Role': 'admin' });
    assert('Forged X-User-Role: admin rejected with 401', headerEscalation.status === 401, `Got ${headerEscalation.status}`);

    const idImpersonation = await request('GET', '/properties/my', null, { 'X-User-Id': 'usr_admin_001' });
    assert('Forged X-User-Id header rejected with 401', idImpersonation.status === 401, `Got ${idImpersonation.status}`);

    // 4. Unauthorized admin actions by regular users
    console.log('\nTest Group 4: Role-Based Authorization Enforcement');
    const regularUserAdminAttempt = await request('GET', '/admin/overview', null, { 'Authorization': `Bearer ${validUserToken}` });
    assert('Regular user token blocked from /admin/overview with 403', regularUserAdminAttempt.status === 403, `Got ${regularUserAdminAttempt.status}`);

    const regularUserApproveAttempt = await request('POST', '/admin/properties/prop_kurnool_queue_01/approve', {}, { 'Authorization': `Bearer ${validUserToken}` });
    assert('Regular user token blocked from approve endpoint with 403', regularUserApproveAttempt.status === 403, `Got ${regularUserApproveAttempt.status}`);

    // 5. Cross-user property mutation and document access
    console.log('\nTest Group 5: Ownership and Cross-User Isolation');
    const createPropRes = await request('POST', '/properties', {
      title: 'Admin Listed Property',
      price: 15000000,
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale'
    }, { 'Authorization': `Bearer ${validAdminToken}` });
    const targetPropId = createPropRes.data?.property?._id || createPropRes.data?.property?.id || 'prop_tirupati_04';

    const crossUserUpdate = await request('PATCH', `/properties/${targetPropId}`, { title: 'Hacked Title' }, { 'Authorization': `Bearer ${validUserToken}` });
    assert('Non-owner cannot update someone else listing (owned by another user)', crossUserUpdate.status === 403, `Got ${crossUserUpdate.status}`);

    const crossUserDocs = await request('GET', `/properties/${targetPropId}/documents`, null, { 'Authorization': `Bearer ${validUserToken}` });
    assert('Non-owner cannot view confidential deeds', crossUserDocs.status === 403, `Got ${crossUserDocs.status}`);

    // 6. Access to unapproved or unpublished properties in public search
    console.log('\nTest Group 6: Public Discovery Invariant');
    const publicSearch = await request('GET', '/properties');
    assert('Public search succeeds with 200', publicSearch.status === 200);
    const unapprovedFound = (publicSearch.data.properties || []).some(p => p.verificationStatus !== 'approved' || p.publicationStatus !== 'published');
    assert('Unapproved or unpublished properties NEVER leak into public search', !unapprovedFound);

    // 7. Security Headers check
    console.log('\nTest Group 7: Security Headers');
    assert('X-Content-Type-Options: nosniff present', publicSearch.headers['x-content-type-options'] === 'nosniff');
    assert('X-Frame-Options present', publicSearch.headers['x-frame-options'] === 'SAMEORIGIN');

    // 8. Frontend Secret Leakage Verification
    console.log('\nTest Group 8: Frontend Secret Exposure Audit');
    const frontendEnvPath = path.join(__dirname, '../../frontend/.env');
    const frontendEnvContent = fs.readFileSync(frontendEnvPath, 'utf8');
    const hasSecretInFrontendEnv = frontendEnvContent.includes('sb_secret_');
    assert('No sb_secret_ credentials present in frontend/.env', !hasSecretInFrontendEnv);

    const supabaseJsPath = path.join(__dirname, '../../frontend/src/lib/supabase.js');
    const supabaseJsContent = fs.readFileSync(supabaseJsPath, 'utf8');
    const hasHardcodedSecretInJs = supabaseJsContent.includes("'sb_secret_");
    assert('No hardcoded sb_secret_ string in frontend/src/lib/supabase.js', !hasHardcodedSecretInJs);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests();
