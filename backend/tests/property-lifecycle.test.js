/**
 * Comprehensive Property Lifecycle, Revisions, Removal & Ownership Restrictions Test Suite
 * Scenarios Tested:
 * Scenario A: New property creation & initial approval
 * Scenario B: Edit an approved property (triggers revision & admin reapproval)
 * Scenario C: Rejected revision (restores last approved version)
 * Scenario D: Permanent removal (deletes from discovery, detail URLs, and booking)
 * Scenario E: Ownership restrictions (exclusion from discovery, visits, offers, calls, inquiries)
 * Scenario F: Authorization (role-based boundaries, anti-self-approval, cross-user edit prevention)
 * Scenario G: Concurrency & synchronization (stale revision approval rejected with 409)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { db } = require('../src/config/database');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'property_marketplace_jwt_secret_2026';

let server;
let port;
let baseUrl;

function makeToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, email: user.email, roles: user.roles || ['user'] },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

const ownerUser = { id: 'usr_client_001', _id: 'usr_client_001', email: 'owner@landpin.com', roles: ['user'], name: 'Owner User' };
const buyerUser = { id: 'usr_seller_002', _id: 'usr_seller_002', email: 'sunita.hegde@example.com', roles: ['user'], name: 'Sunita Hegde' };
const adminUser = { id: 'usr_admin_001', _id: 'usr_admin_001', email: 'admin@landpin.com', roles: ['admin'], name: 'Admin Officer' };

const ownerToken = makeToken(ownerUser);
const buyerToken = makeToken(buyerUser);
const adminToken = makeToken(adminUser);

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
      hostname: 'localhost',
      port: port,
      path: `/api/v1${path}`,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
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

function assert(scenario, condition, message) {
  if (condition) {
    console.log(`  ✅ PASS [${scenario}]: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL [${scenario}]: ${message}`);
    failed++;
  }
}

async function runLifecycleTests() {
  console.log('====================================================');
  console.log('🏛️ LANDPIN PROPERTY LIFECYCLE & VISIBILITY TEST SUITE');
  console.log('====================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      resolve();
    });
  });

  try {
    let createdPropId;

    // Clean out prior test runs to ensure fresh anti-duplicate validations
    db.properties = db.properties.filter(p => 
      !p.title?.includes('Palm Grove') && 
      !p.title?.includes('Oakwood') && 
      !p.title?.includes('Magnolia')
    );

    const testRun = Date.now().toString(36);
    const titleA = `Palm Grove Eco Villa ${testRun}`;
    const titleB = `Palm Grove Eco Villa (Renovated with Rooftop Solarium ${testRun})`;

    // =========================================================================
    // SCENARIO A: New Property Creation & Initial Approval
    // =========================================================================
    console.log('--- Scenario A: New Property Lifecycle ---');

    // 1. Owner creates property
    const createRes = await request('POST', '/properties', {
      title: titleA,
      description: 'Solar powered luxury villa in Sarjapur corridor',
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: '₹2,75,00,000',
      area: { value: 3200, unit: 'sqft' },
      bedrooms: 4,
      bathrooms: 4,
      location: { city: 'Bengaluru', locality: 'Sarjapur' }
    }, ownerToken);

    assert('A.1', createRes.status === 201, `Property created with status 201 (got ${createRes.status})`);
    assert('A.2', createRes.body.property?.verificationStatus === 'pending_review', 'Listing status is pending_review');
    assert('A.3', createRes.body.property?.publicationStatus === 'unpublished', 'Listing publication status is unpublished');
    createdPropId = createRes.body.property._id;

    // 2. Buyer public search: newly created property is NOT visible
    const buyerSearch1 = await request('GET', '/properties', null, buyerToken);
    const inBuyerSearch1 = (buyerSearch1.body.properties || []).some(p => p._id === createdPropId);
    assert('A.4', !inBuyerSearch1, 'Newly created property is hidden from public buyer search results');

    // 3. Buyer direct detail URL is blocked (403)
    const directGet1 = await request('GET', `/properties/${createdPropId}`, null, buyerToken);
    assert('A.5', directGet1.status === 403, `Direct public access to unapproved listing rejected with 403 (got ${directGet1.status})`);

    // 4. Owner CAN view it in their dashboard
    const ownerDashboard = await request('GET', '/properties/my', null, ownerToken);
    const inOwnerDashboard = (ownerDashboard.body.properties || []).some(p => p._id === createdPropId);
    assert('A.6', inOwnerDashboard, 'Listing is visible in owner dashboard under my listings');

    // 5. Admin approves the listing
    const adminApprove1 = await request('POST', `/admin/properties/${createdPropId}/approve`, {}, adminToken);
    assert('A.7', adminApprove1.status === 200, 'Admin successfully approves initial listing');
    assert('A.8', adminApprove1.body.property?.verificationStatus === 'approved' && adminApprove1.body.property?.publicationStatus === 'published', `Property is now approved and published (got verif: ${adminApprove1.body.property?.verificationStatus}, pub: ${adminApprove1.body.property?.publicationStatus})`);

    // 6. Other users can now discover it
    const buyerSearch2 = await request('GET', '/properties', null, buyerToken);
    const inBuyerSearch2 = (buyerSearch2.body.properties || []).some(p => p._id === createdPropId);
    assert('A.9', inBuyerSearch2, 'Approved listing is now discoverable by other users in public search');

    // 7. Owner searching in public search NEVER sees their own listing (Requirement 5)
    const ownerSearch = await request('GET', '/properties', null, ownerToken);
    const inOwnerSearch = (ownerSearch.body.properties || []).some(p => p._id === createdPropId);
    assert('A.10', !inOwnerSearch, 'Owner is strictly excluded from seeing their own property in discovery');

    // =========================================================================
    // SCENARIO B: Edit an Approved Property (Triggers Reapproval)
    // =========================================================================
    console.log('\n--- Scenario B: Editing an Approved Property ---');

    // 1. Owner edits approved property
    const editRes = await request('PATCH', `/properties/${createdPropId}`, {
      title: titleB,
      price: '₹3,10,00,000'
    }, ownerToken);

    assert('B.1', editRes.status === 200, `Edit request succeeded with 200 (got ${editRes.status})`);
    assert('B.2', editRes.body.isRevision === true, 'Backend recognized edit of approved listing and created revision');
    assert('B.3', editRes.body.revision?.status === 'pending_review', 'Revision status is pending_review');

    // 2. Unapproved changes are NOT published to the public
    const buyerSearch3 = await request('GET', '/properties', null, buyerToken);
    const inBuyerSearch3 = (buyerSearch3.body.properties || []).some(p => p._id === createdPropId);
    assert('B.4', !inBuyerSearch3, 'Property is temporarily removed from public discovery while revision is pending');

    // 3. New bookings disabled while revision is pending
    const bookTomorrow = new Date(Date.now() + 86400000).toISOString();
    const bookTomorrowEnd = new Date(Date.now() + 90000000).toISOString();
    const bookingAttempt = await request('POST', '/appointments', {
      propertyId: createdPropId,
      startAt: bookTomorrow,
      endAt: bookTomorrowEnd
    }, buyerToken);
    assert('B.5', bookingAttempt.status === 400 && bookingAttempt.body.code === 'PENDING_REVISION', 'New booking attempt blocked during pending revision (400 PENDING_REVISION)');

    // 4. Admin approves the revision
    const revisionId = editRes.body.revision._id;
    const revisionVersion = editRes.body.revision.version;
    const adminApproveRev = await request('POST', `/admin/properties/${createdPropId}/approve`, {
      revisionId,
      version: revisionVersion
    }, adminToken);

    assert('B.6', adminApproveRev.status === 200, 'Admin approves revision');
    assert('B.7', adminApproveRev.body.property?.title.includes('Renovated with Rooftop Solarium'), 'Approved changes atomically promoted to property');
    assert('B.8', adminApproveRev.body.property?.publicationStatus === 'published', 'Property returned to published status');

    // 5. Updated information available to public and booking restored
    const buyerSearch4 = await request('GET', '/properties', null, buyerToken);
    const foundProp = (buyerSearch4.body.properties || []).find(p => p._id === createdPropId);
    assert('B.9', foundProp && foundProp.title.includes('Renovated with Rooftop Solarium'), 'Updated title visible in public search after revision approval');

    // =========================================================================
    // SCENARIO C: Rejected Revision (Restores Last Approved Version)
    // =========================================================================
    console.log('\n--- Scenario C: Revision Rejection ---');

    // 1. Owner submits new edit (Revision C)
    const editRes2 = await request('PATCH', `/properties/${createdPropId}`, {
      title: 'Palm Grove Eco Villa (Excessive Unverified Claim)',
      price: '₹9,99,00,000'
    }, ownerToken);
    assert('C.1', editRes2.status === 200 && editRes2.body.isRevision === true, 'Owner submits second revision');

    // 2. Admin rejects the revision
    const rev2Id = editRes2.body.revision._id;
    const adminRejectRev = await request('POST', `/admin/properties/${createdPropId}/reject`, {
      reason: 'Price jump violates regional valuation cap without justification',
      revisionId: rev2Id
    }, adminToken);

    assert('C.2', adminRejectRev.status === 200, 'Admin rejects revision');
    assert('C.3', adminRejectRev.body.property?.publicationStatus === 'published', 'Last approved version restored to published state');
    assert('C.4', adminRejectRev.body.property?.title.includes('Renovated with Rooftop Solarium'), 'Rejected changes discarded; previously approved title retained');

    // 3. Last approved version restored in public discovery
    const buyerSearch5 = await request('GET', '/properties', null, buyerToken);
    const restoredProp = (buyerSearch5.body.properties || []).find(p => p._id === createdPropId);
    assert('C.5', restoredProp && !restoredProp.title.includes('Excessive Unverified Claim'), 'Public discovery shows restored approved version, not rejected revision');

    // =========================================================================
    // SCENARIO D: Permanent Removal
    // =========================================================================
    console.log('\n--- Scenario D: Permanent Removal ---');

    // 1. Owner removes property
    const removeRes = await request('DELETE', `/properties/${createdPropId}`, null, ownerToken);
    assert('D.1', removeRes.status === 200, `Owner permanently removes property (status 200, got ${removeRes.status})`);

    // 2. Property disappears from public discovery
    const buyerSearch6 = await request('GET', '/properties', null, buyerToken);
    const inBuyerSearch6 = (buyerSearch6.body.properties || []).some(p => p._id === createdPropId);
    assert('D.2', !inBuyerSearch6, 'Removed property disappeared from public search');

    // 3. Direct detail lookup returns 404
    const directGetRemoved = await request('GET', `/properties/${createdPropId}`, null, buyerToken);
    assert('D.3', directGetRemoved.status === 404, 'Direct access to removed property returns 404');

    // 4. Booking attempts fail with 404
    const bookRemoved = await request('POST', '/appointments', {
      propertyId: createdPropId,
      startAt: bookTomorrow,
      endAt: bookTomorrowEnd
    }, buyerToken);
    assert('D.4', bookRemoved.status === 404, 'Booking attempt on removed property returns 404');

    // 5. Owner dashboard no longer shows removed property
    const ownerDashboard2 = await request('GET', '/properties/my', null, ownerToken);
    const inOwnerDashboard2 = (ownerDashboard2.body.properties || []).some(p => p._id === createdPropId);
    assert('D.5', !inOwnerDashboard2, 'Removed property is purged from owner dashboard');

    // =========================================================================
    // SCENARIO E: Ownership Restrictions (Self-Booking / Self-Transacting)
    // =========================================================================
    console.log('\n--- Scenario E: Ownership Restrictions ---');

    // Use an active published property
    const activeProp = db.properties.find(p => 
      p.verificationStatus === 'approved' && 
      p.publicationStatus === 'published' && 
      p.availabilityStatus === 'available' &&
      !p.isRemoved
    ) || db.properties[0];

    const testPropId = activeProp._id;
    const testOwnerToken = makeToken({ id: activeProp.ownerId, _id: activeProp.ownerId, email: 'testowner@landpin.com', roles: ['user'] });
    const testBuyerToken = (buyerUser._id !== activeProp.ownerId) ? buyerToken : ownerToken;

    // 1. Owner booking visit on own listing
    const selfVisit = await request('POST', '/appointments', {
      propertyId: testPropId,
      startAt: bookTomorrow,
      endAt: bookTomorrowEnd
    }, testOwnerToken);
    assert('E.1', selfVisit.status === 400 && selfVisit.body.code === 'OWNER_SELF_BOOKING', 'Owner booking visit on own listing blocked with 400 OWNER_SELF_BOOKING');

    // 2. Owner submitting offer on own listing
    const selfOffer = await request('POST', '/properties/offers', {
      propertyId: testPropId,
      offerAmount: '38000000'
    }, testOwnerToken);
    assert('E.2', selfOffer.status === 400 && selfOffer.body.code === 'OWNER_SELF_OFFER', 'Owner submitting offer on own listing blocked with 400 OWNER_SELF_OFFER');

    // 3. Owner sending inquiry to own listing
    const selfInq = await request('POST', '/appointments/inquiries', {
      propertyId: testPropId,
      message: 'I want to ask myself a question'
    }, testOwnerToken);
    assert('E.3', selfInq.status === 400 && selfInq.body.code === 'OWNER_SELF_INQUIRY', 'Owner sending inquiry on own listing blocked with 400 OWNER_SELF_INQUIRY');

    // 4. Owner requesting call on own listing
    const selfCall = await request('POST', '/appointments/calls', {
      propertyId: testPropId,
      phone: '9876543210'
    }, testOwnerToken);
    assert('E.4', selfCall.status === 400 && selfCall.body.code === 'OWNER_SELF_CALL', 'Owner requesting call on own listing blocked with 400 OWNER_SELF_CALL');

    // 5. Eligible buyer CAN schedule visit
    const validVisit = await request('POST', '/appointments', {
      propertyId: testPropId,
      startAt: bookTomorrow,
      endAt: bookTomorrowEnd
    }, testBuyerToken);
    assert('E.5', validVisit.status === 201, 'Eligible buyer successfully schedules visit on approved listing (201 Created)');

    // =========================================================================
    // SCENARIO F: Authorization Rules
    // =========================================================================
    console.log('\n--- Scenario F: Authorization Rules ---');

    // 1. Regular user cannot approve properties
    const userApprove = await request('POST', '/admin/properties/prop_001/approve', {}, buyerToken);
    assert('F.1', userApprove.status === 403, 'Regular user blocked from admin approve endpoint with 403');

    // 2. Regular user cannot delete another person\'s property
    const crossDelete = await request('DELETE', '/properties/prop_001', null, buyerToken);
    assert('F.2', crossDelete.status === 403, 'User cannot delete another user\'s property (403 Forbidden)');

    // 3. Unauthenticated requests blocked
    const unauthDelete = await request('DELETE', '/properties/prop_001', null, null);
    assert('F.3', unauthDelete.status === 401, 'Unauthenticated delete rejected with 401 Unauthorized');

    // =========================================================================
    // SCENARIO G: Concurrency & Tombstone Integrity
    // =========================================================================
    console.log('\n--- Scenario G: Concurrency & Synchronization ---');

    // 1. Admin cannot approve removed property
    const approveRemoved = await request('POST', `/admin/properties/${createdPropId}/approve`, {}, adminToken);
    assert('G.1', approveRemoved.status === 404, 'Admin approval on permanently removed property rejected with 404');

    // 2. Concurrency mismatch on revision
    // Create new approved property for test
    const propG = {
      _id: 'prop_test_g',
      ownerId: ownerUser.id,
      title: 'Concurrency Test Property',
      price: 5000000,
      verificationStatus: 'approved',
      publicationStatus: 'published',
      availabilityStatus: 'available',
      version: 1
    };
    db.properties.push(propG);

    // Owner creates revision v2 (rev_v2)
    const rev2 = await request('PATCH', `/properties/${propG._id}`, { title: 'Revision 2 Title' }, ownerToken);
    const staleRevisionId = rev2.body.revision._id;

    // Owner submits newer revision v3 (rev_v3)
    const rev3 = await request('PATCH', `/properties/${propG._id}`, { title: 'Revision 3 Title' }, ownerToken);

    // Stale admin approval with old rev_v2 is rejected
    const staleApprove = await request('POST', `/admin/properties/${propG._id}/approve`, { revisionId: staleRevisionId }, adminToken);
    assert('G.2', staleApprove.status === 409, 'Stale revision approval rejected with 409 Conflict');

    // Clean up test prop
    db.properties = db.properties.filter(p => p._id !== propG._id);

    // =========================================================================
    // SCENARIO H: Anti-Duplicate Property Listing Protection
    // =========================================================================
    console.log('\n--- Scenario H: Anti-Duplicate Property Protection ---');

    // 1. Post original property H1
    const propH1 = await request('POST', '/properties', {
      title: 'Oakwood Residency Villa',
      description: 'Prime independent villa in Bellandur',
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: '₹2,50,00,000',
      area: { value: 2800, unit: 'sqft' },
      bedrooms: 4,
      bathrooms: 4,
      location: { 
        address: 'No. 88, Green Glen Layout', 
        locality: 'Bellandur', 
        city: 'Bengaluru',
        coordinates: [77.6712, 12.9261]
      },
      landDetails: { surveyNumber: 'Sy. No. 108/4A' }
    }, ownerToken);
    assert('H.1', propH1.status === 201, 'Original property created with 201 (got 201)');
    const h1Id = propH1.body.property?._id;

    // 2. Duplicate Check: Same owner attempting to post identical title in same locality
    const dupTitle = await request('POST', '/properties', {
      title: 'Oakwood Residency Villa',
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: '₹2,60,00,000',
      area: { value: 2800, unit: 'sqft' },
      location: { locality: 'Bellandur', city: 'Bengaluru' }
    }, ownerToken);
    assert('H.2', dupTitle.status === 409 && dupTitle.body.code === 'DUPLICATE_OWNER_LISTING', 'Duplicate posting by same owner blocked with 409 DUPLICATE_OWNER_LISTING');

    // 3. Duplicate Check: Any user posting duplicate Cadastral Survey Number
    const dupSurvey = await request('POST', '/properties', {
      title: 'Different Villa Name by Another User',
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: '₹3,00,00,000',
      area: { value: 3000, unit: 'sqft' },
      location: { locality: 'Bellandur', city: 'Bengaluru' },
      landDetails: { surveyNumber: 'Sy. No. 108/4A' }
    }, buyerToken);
    assert('H.3', dupSurvey.status === 409 && dupSurvey.body.code === 'DUPLICATE_SURVEY_NUMBER', 'Duplicate cadastral survey number blocked with 409 DUPLICATE_SURVEY_NUMBER');

    // 4. Duplicate Check: Any user posting identical physical street address
    const dupAddress = await request('POST', '/properties', {
      title: 'Unique Title but Same Address',
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: '₹2,90,00,000',
      area: { value: 2800, unit: 'sqft' },
      location: { 
        address: 'No. 88, Green Glen Layout', 
        locality: 'Bellandur', 
        city: 'Bengaluru' 
      }
    }, buyerToken);
    assert('H.4', dupAddress.status === 409 && dupAddress.body.code === 'DUPLICATE_ADDRESS', 'Duplicate physical street address blocked with 409 DUPLICATE_ADDRESS');

    // 5. Duplicate Check: Exact GPS Coordinates collision (< 20 meters)
    const dupGPS = await request('POST', '/properties', {
      title: 'Villa at Exact Coordinates',
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: '₹2,80,00,000',
      area: { value: 2800, unit: 'sqft' },
      location: { 
        locality: 'Bellandur', 
        city: 'Bengaluru',
        coordinates: [77.671201, 12.926102]
      }
    }, ownerToken);
    assert('H.5', dupGPS.status === 409 && dupGPS.body.code === 'DUPLICATE_GPS_PIN', 'Duplicate GPS pin coordinates blocked with 409 DUPLICATE_GPS_PIN');

    // 6. Distinct property with different title, address, survey number succeeds
    const distinctProp = await request('POST', '/properties', {
      title: 'Magnolia Meadows Eco Farmhouse',
      category: 'residential',
      propertyType: 'villa',
      purpose: 'sale',
      price: '₹3,40,00,000',
      area: { value: 3500, unit: 'sqft' },
      location: { 
        address: 'Plot 12, Rainbow Drive Layout', 
        locality: 'Sarjapur Road', 
        city: 'Bengaluru',
        coordinates: [77.7123, 12.8945]
      },
      landDetails: { surveyNumber: 'Sy. No. 219/7C' }
    }, ownerToken);
    assert('H.6', distinctProp.status === 201, 'Distinct non-duplicate property accepted with 201 Created');

    // Clean up created props
    if (h1Id) await request('DELETE', `/properties/${h1Id}`, null, ownerToken);
    if (distinctProp.body.property?._id) await request('DELETE', `/properties/${distinctProp.body.property._id}`, null, ownerToken);
  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runLifecycleTests().catch(err => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});
