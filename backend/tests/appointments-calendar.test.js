/**
 * Comprehensive Automated Test Suite: Appointments, Slot Availability & Rescheduling
 * Tests:
 * 1. Slot availability query (GET /api/v1/appointments/availability)
 * 2. Creating an appointment and verifying slot becomes booked
 * 3. Concurrent overlapping booking blocked with 409 APPOINTMENT_CONFLICT
 * 4. Rescheduling to a conflicting slot blocked with 409 APPOINTMENT_CONFLICT
 * 5. Successful rescheduling reserves new slot and releases old slot
 * 6. Another buyer can immediately book the released old slot
 * 7. Rescheduling a cancelled appointment blocked with 400
 * 8. Cancellation frees up the slot
 * 9. Authorization enforcement: cross-user rescheduling blocked with 403
 * 10. Owner self-booking prevention (400 OWNER_SELF_BOOKING)
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

const buyer1 = { id: 'usr_seller_002', _id: 'usr_seller_002', email: 'sunita.hegde@example.com', roles: ['user'], name: 'Sunita Hegde', accountStatus: 'active' };
const buyer2 = { id: 'usr_seller_003', _id: 'usr_seller_003', email: 'dr.patel@example.com', roles: ['user'], name: 'Dr. Ramesh Patel', accountStatus: 'active' };
const ownerUser = { id: 'usr_client_001', _id: 'usr_client_001', email: 'owner@landpin.com', roles: ['user'], name: 'Owner Vikram', accountStatus: 'active' };
const adminUser = { id: 'usr_admin_001', _id: 'usr_admin_001', email: 'admin@landpin.com', roles: ['admin'], name: 'Admin Officer', accountStatus: 'active' };

[buyer1, buyer2, ownerUser, adminUser].forEach(u => {
  if (!db.users.some(existing => existing._id === u._id || existing.id === u.id)) {
    db.users.push(u);
  }
});

const tokenBuyer1 = makeToken(buyer1);
const tokenBuyer2 = makeToken(buyer2);
const tokenOwner = makeToken(ownerUser);
const tokenAdmin = makeToken(adminUser);

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
  console.log('====================================================');
  console.log('📅 LANDPIN APPOINTMENTS, AVAILABILITY & RESCHEDULING TEST SUITE');
  console.log('====================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      resolve();
    });
  });

  try {
    const targetPropId = 'prop_001';
    if (!db.properties.some(p => p._id === targetPropId || p.id === targetPropId)) {
      db.properties.push({
        _id: targetPropId,
        id: targetPropId,
        ownerId: ownerUser._id,
        title: 'Appointment Test Property',
        price: 3500000,
        verificationStatus: 'approved',
        publicationStatus: 'published',
        availabilityStatus: 'available'
      });
    }
    // Clean any leftover appointments for targetPropId from previous runs
    db.appointments = db.appointments.filter(a => a.propertyId !== targetPropId || a.status !== 'confirmed');

    // Future date (random 40 to 120 days from now to guarantee isolation across test runs)
    const futureDateObj = new Date();
    const randomDays = 40 + Math.floor(Math.random() * 80);
    futureDateObj.setDate(futureDateObj.getDate() + randomDays);
    const yyyy = futureDateObj.getFullYear();
    const mm = String(futureDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(futureDateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    console.log(`--- Test Group 1: Authoritative Slot Availability (Date: ${dateStr}) ---`);
    const availRes1 = await request('GET', `/appointments/availability?propertyId=${targetPropId}&date=${dateStr}`, null, tokenBuyer1);
    assert(availRes1.status === 200, `Slot availability responds with 200 (got ${availRes1.status})`);
    assert(availRes1.body.slots && availRes1.body.slots.length === 5, `Returns 5 standard time slots`);
    assert(availRes1.body.slots.every(s => s.isAvailable === true), `All future slots initially available`);

    console.log('\n--- Test Group 2: Create Appointment & Verify Slot Locking ---');
    const slot10 = availRes1.body.slots[0]; // 10:00 - 11:00
    const slot1130 = availRes1.body.slots[1]; // 11:30 - 12:30

    const bookRes1 = await request('POST', '/appointments', {
      propertyId: targetPropId,
      startAt: slot10.startAt,
      endAt: slot10.endAt,
      notes: 'Buyer 1 Cadastral Verification Visit'
    }, tokenBuyer1);

    assert(bookRes1.status === 201, `Buyer 1 books 10:00-11:00 slot with 201 Created (got ${bookRes1.status})`);
    const apt1Id = bookRes1.body.appointment._id;

    // Re-check slot availability
    const availRes2 = await request('GET', `/appointments/availability?propertyId=${targetPropId}&date=${dateStr}`, null, tokenBuyer1);
    const evaluatedSlot10 = availRes2.body.slots.find(s => s.id === '10:00-11:00');
    assert(evaluatedSlot10.isBooked === true && evaluatedSlot10.isAvailable === false, `10:00-11:00 slot is marked as booked and unavailable`);

    console.log('\n--- Test Group 3: Concurrent Booking Conflict Protection ---');
    const bookRes2Conflict = await request('POST', '/appointments', {
      propertyId: targetPropId,
      startAt: slot10.startAt,
      endAt: slot10.endAt,
      notes: 'Buyer 2 conflicting attempt'
    }, tokenBuyer2);

    assert(bookRes2Conflict.status === 409, `Buyer 2 booking overlapping slot blocked with 409 APPOINTMENT_CONFLICT (got ${bookRes2Conflict.status})`);
    assert(bookRes2Conflict.body.code === 'APPOINTMENT_CONFLICT', `Returns code APPOINTMENT_CONFLICT`);

    console.log('\n--- Test Group 4: Owner Self-Booking Protection ---');
    const ownerSelfRes = await request('POST', '/appointments', {
      propertyId: targetPropId,
      startAt: slot1130.startAt,
      endAt: slot1130.endAt,
      notes: 'Owner self visit'
    }, tokenOwner);

    assert(ownerSelfRes.status === 400, `Owner attempting to book own property rejected with 400 (got ${ownerSelfRes.status})`);
    assert(ownerSelfRes.body.code === 'OWNER_SELF_BOOKING', `Returns OWNER_SELF_BOOKING`);

    console.log('\n--- Test Group 5: Rescheduling & Slot Release ---');
    // Buyer 2 books 11:30 - 12:30 slot
    const bookRes2 = await request('POST', '/appointments', {
      propertyId: targetPropId,
      startAt: slot1130.startAt,
      endAt: slot1130.endAt,
      notes: 'Buyer 2 Mid-day visit'
    }, tokenBuyer2);
    assert(bookRes2.status === 201, `Buyer 2 books 11:30-12:30 slot`);

    // Buyer 1 attempts to reschedule into Buyer 2's slot (should fail with 409)
    const reschedConflict = await request('POST', `/appointments/${apt1Id}/reschedule`, {
      newStartAt: slot1130.startAt,
      newEndAt: slot1130.endAt,
      notes: 'Reschedule into occupied slot'
    }, tokenBuyer1);
    assert(reschedConflict.status === 409, `Rescheduling into occupied slot blocked with 409 APPOINTMENT_CONFLICT (got ${reschedConflict.status})`);

    // Buyer 1 reschedules to Afternoon slot (14:00 - 15:00)
    const slot14 = availRes1.body.slots[2];
    const reschedSuccess = await request('POST', `/appointments/${apt1Id}/reschedule`, {
      newStartAt: slot14.startAt,
      newEndAt: slot14.endAt,
      notes: 'Rescheduled to afternoon viewing'
    }, tokenBuyer1);

    assert(reschedSuccess.status === 200, `Buyer 1 successfully reschedules to afternoon slot (got ${reschedSuccess.status})`);
    assert(reschedSuccess.body.appointment.rescheduledFrom !== undefined, `Appointment records previous slot in rescheduledFrom`);

    console.log('\n--- Test Group 6: Verification that Old Slot was Released ---');
    // Re-check slot availability: 10:00-11:00 must now be AVAILABLE!
    const availRes3 = await request('GET', `/appointments/availability?propertyId=${targetPropId}&date=${dateStr}`, null, tokenBuyer1);
    const releasedSlot10 = availRes3.body.slots.find(s => s.id === '10:00-11:00');
    assert(releasedSlot10.isAvailable === true && releasedSlot10.isBooked === false, `Old slot (10:00-11:00) was freed and is now available`);

    // Another buyer can now claim the released 10:00-11:00 slot
    const claimReleasedSlot = await request('POST', '/appointments', {
      propertyId: targetPropId,
      startAt: slot10.startAt,
      endAt: slot10.endAt,
      notes: 'Buyer 2 claims released morning slot'
    }, tokenBuyer2);
    assert(claimReleasedSlot.status === 201, `Buyer 2 successfully claims the released 10:00-11:00 slot (got ${claimReleasedSlot.status})`);

    console.log('\n--- Test Group 7: Authorization & Lifecycle Restrictions ---');
    // Buyer 2 cannot reschedule Buyer 1's appointment
    const unauthResched = await request('POST', `/appointments/${apt1Id}/reschedule`, {
      newStartAt: slot14.startAt,
      newEndAt: slot14.endAt
    }, tokenBuyer2);
    assert(unauthResched.status === 403, `Unauthorized cross-user reschedule rejected with 403 (got ${unauthResched.status})`);

    // Cancel Buyer 1's appointment
    const cancelRes = await request('POST', `/appointments/${apt1Id}/cancel`, {}, tokenBuyer1);
    assert(cancelRes.status === 200, `Buyer 1 cancels appointment with 200 OK`);

    // Cannot reschedule an already cancelled appointment
    const reschedCancelled = await request('POST', `/appointments/${apt1Id}/reschedule`, {
      newStartAt: slot14.startAt,
      newEndAt: slot14.endAt
    }, tokenBuyer1);
    assert(reschedCancelled.status === 400, `Rescheduling a cancelled appointment rejected with 400 (got ${reschedCancelled.status})`);

    console.log('\n--- Test Group 8: Same User Overlapping Bookings Across Properties ---');
    // Buyer 1 books slot on prop_001
    const slot16 = availRes1.body.slots[3]; // 16:00 - 17:00
    const b1Prop1Res = await request('POST', '/appointments', {
      propertyId: 'prop_001',
      startAt: slot16.startAt,
      endAt: slot16.endAt,
      notes: 'Buyer 1 viewing on prop_001'
    }, tokenBuyer1);
    assert(b1Prop1Res.status === 201, `Buyer 1 books 16:00-17:00 on prop_001 (got ${b1Prop1Res.status})`);

    // Ensure an eligible second property exists owned by usr_client_001 (not Buyer 1)
    let propSecond = db.properties.find(p => p._id === 'prop_second_apt');
    if (!propSecond) {
      propSecond = {
        _id: 'prop_second_apt',
        ownerId: 'usr_client_001',
        title: 'Second Test Property for Schedule Conflicts',
        category: 'residential',
        propertyType: 'villa',
        purpose: 'sale',
        price: 30000000,
        verificationStatus: 'approved',
        publicationStatus: 'published',
        availabilityStatus: 'available',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      db.properties.push(propSecond);
    }

    // Buyer 1 tries to book overlapping appointment at 16:00-17:00 on DIFFERENT property (prop_second_apt)
    const b1Prop3Overlap = await request('POST', '/appointments', {
      propertyId: 'prop_second_apt',
      startAt: slot16.startAt,
      endAt: slot16.endAt,
      notes: 'Buyer 1 overlapping attempt on prop_second_apt'
    }, tokenBuyer1);
    assert(b1Prop3Overlap.status === 409 && b1Prop3Overlap.body.code === 'USER_OVERLAPPING_BOOKING', `Same user blocked from booking overlapping slot on different property (409 USER_OVERLAPPING_BOOKING)`);

    // Clean up Buyer 1 appointment
    if (b1Prop1Res.body?.appointment?._id) {
      await request('POST', `/appointments/${b1Prop1Res.body.appointment._id}/cancel`, {}, tokenBuyer1);
    }

    console.log('\n--- Test Group 9: Call Slots — Multiple Users Overlap Allowed vs Same User Duplicate Blocked ---');
    const callSlotTime = 'Tomorrow morning (10:00 AM - 1:00 PM)';
    // Buyer 1 requests call slot for callSlotTime on prop_001
    const callResBuyer1 = await request('POST', '/appointments/calls', {
      propertyId: 'prop_001',
      preferredTime: callSlotTime,
      phone: '+91 98450 11111',
      note: 'Buyer 1 title inquiry'
    }, tokenBuyer1);
    assert(callResBuyer1.status === 201, `Buyer 1 requests call for "${callSlotTime}" with 201 Created`);

    // Buyer 2 requests call slot for the EXACT SAME overlapping callSlotTime on prop_001 (MULTIPLE USERS CAN BOOK CALL SLOTS AT SAME TIME)
    const callResBuyer2 = await request('POST', '/appointments/calls', {
      propertyId: 'prop_001',
      preferredTime: callSlotTime,
      phone: '+91 98450 22222',
      note: 'Buyer 2 negotiation inquiry'
    }, tokenBuyer2);
    assert(callResBuyer2.status === 201, `Buyer 2 also successfully requests overlapping call slot for same time window (Multiple users allowed)`);

    // Buyer 1 attempts to submit DUPLICATE active call request for the SAME slot on prop_001 (SAME USER CANNOT BOOK SAME OVERLAPPING CALL)
    const callResBuyer1Duplicate = await request('POST', '/appointments/calls', {
      propertyId: 'prop_001',
      preferredTime: callSlotTime,
      phone: '+91 98450 11111',
      note: 'Buyer 1 duplicate submission'
    }, tokenBuyer1);
    assert(callResBuyer1Duplicate.status === 409 && callResBuyer1Duplicate.body.code === 'USER_DUPLICATE_CALL_REQUEST', `Same user blocked from submitting duplicate overlapping call request (409 USER_DUPLICATE_CALL_REQUEST)`);

    // Clean up created appointments
    db.appointments = db.appointments.filter(a => a._id !== apt1Id && a._id !== bookRes2.body?.appointment?._id && a._id !== claimReleasedSlot.body?.appointment?._id && a._id !== b1Prop1Res.body?.appointment?._id);

    console.log('\n====================================================');
    console.log(`📊 SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (server) server.close();
    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runTests();
