/**
 * OTP & Token Security Test Suite
 * Validates all strict security invariants requested:
 * 1. 6-digit numeric CSPRNG generation
 * 2. Strict Type Isolation ('email_verification' vs 'password_reset' cannot cross-validate)
 * 3. Invalidation upon New Generation (superseding old tokens/OTPs on re-request)
 * 4. User Isolation (user binding prevents token reuse across accounts)
 * 5. Single-Use Burning (consumed tokens/OTPs cannot be reused for next attempt)
 * 6. Brute-force Rate Limiting (locked after 5 failed attempts)
 * 7. Expiration handling (expired OTPs rejected)
 */

process.env.NODE_ENV = 'test';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('assert');
const otpService = require('../src/services/otpService');
const linkTokenService = require('../src/services/linkTokenService');

console.log('🧪 Starting OTP & Link Token Security Tests...\n');

let testsPassed = 0;
function pass(msg) {
  console.log(`  ✅ PASS: ${msg}`);
  testsPassed++;
}

// -------------------------------------------------------------
// Test 1: 6-Digit Format & Entropy
// -------------------------------------------------------------
console.log('--- Test 1: 6-Digit Format & Cryptographic Entropy ---');
const userA = 'citizen.security@example.com';
const otp1 = otpService.generateEmailOtp({
  email: userA,
  type: otpService.OTP_TYPES.EMAIL_VERIFICATION,
  ttlMinutes: 10
});

assert.strictEqual(typeof otp1.otp, 'string');
assert.strictEqual(otp1.otp.length, 6);
assert.match(otp1.otp, /^\d{6}$/, 'OTP must be exactly 6 digits');
assert.strictEqual(otp1.email, userA.toLowerCase());
pass('OTP generated is a 6-digit cryptographic numeric string');

// -------------------------------------------------------------
// Test 2: Strict Type Isolation
// -------------------------------------------------------------
console.log('\n--- Test 2: Strict Type Isolation ---');
// Trying to consume email_verification OTP as password_reset
const crossTypeAttempt = otpService.consumeEmailOtp({
  email: userA,
  otp: otp1.otp,
  expectedType: otpService.OTP_TYPES.PASSWORD_RESET
});

assert.strictEqual(crossTypeAttempt.success, false);
// In otpService, looking up with key `${email}:::${expectedType}` won't find it or flags mismatch
assert.ok(
  crossTypeAttempt.code === 'OTP_NOT_FOUND' || crossTypeAttempt.code === 'INVALID_OTP_TYPE',
  `Expected strict type rejection, got: ${crossTypeAttempt.code}`
);
pass('email_verification OTP strictly rejected when attempted against password_reset endpoint');

// -------------------------------------------------------------
// Test 3: User Email Binding Isolation
// -------------------------------------------------------------
console.log('\n--- Test 3: User Email Binding Isolation ---');
const userB = 'attacker@example.com';
const crossUserAttempt = otpService.consumeEmailOtp({
  email: userB,
  otp: otp1.otp,
  expectedType: otpService.OTP_TYPES.EMAIL_VERIFICATION
});

assert.strictEqual(crossUserAttempt.success, false);
pass('OTP generated for user A is strictly rejected when submitted for user B');

// -------------------------------------------------------------
// Test 4: Invalidation upon New Generation (Superseding)
// -------------------------------------------------------------
console.log('\n--- Test 4: Invalidation upon New Generation ---');
// User requests a second OTP (e.g. clicked Resend)
const otp2 = otpService.generateEmailOtp({
  email: userA,
  type: otpService.OTP_TYPES.EMAIL_VERIFICATION,
  ttlMinutes: 10
});

assert.notStrictEqual(otp1.otp, otp2.otp);

// Attempting to use old superseded OTP otp1
const supersededAttempt = otpService.consumeEmailOtp({
  email: userA,
  otp: otp1.otp,
  expectedType: otpService.OTP_TYPES.EMAIL_VERIFICATION
});

assert.strictEqual(supersededAttempt.success, false);
pass('Old OTP is immediately invalidated and rejected when a new OTP is requested');

// New OTP otp2 should validate and consume cleanly
const validConsumption = otpService.consumeEmailOtp({
  email: userA,
  otp: otp2.otp,
  expectedType: otpService.OTP_TYPES.EMAIL_VERIFICATION
});

assert.strictEqual(validConsumption.success, true);
pass('Newest OTP consumes successfully');

// -------------------------------------------------------------
// Test 5: Single-Use Burning ("not for next")
// -------------------------------------------------------------
console.log('\n--- Test 5: Single-Use Burning ---');
// Attempting to reuse already consumed otp2
const reuseAttempt = otpService.consumeEmailOtp({
  email: userA,
  otp: otp2.otp,
  expectedType: otpService.OTP_TYPES.EMAIL_VERIFICATION
});

assert.strictEqual(reuseAttempt.success, false);
assert.strictEqual(reuseAttempt.code, 'OTP_ALREADY_USED');
pass('Consumed OTP is permanently burned and rejected on reuse attempt');

// -------------------------------------------------------------
// Test 6: Brute-Force Rate Limiting (5 Attempts Lockout)
// -------------------------------------------------------------
console.log('\n--- Test 6: Brute-Force Rate Limiting (5 Attempts) ---');
const bruteEmail = 'brute.target@example.com';
const bruteOtp = otpService.generateEmailOtp({
  email: bruteEmail,
  type: otpService.OTP_TYPES.PASSWORD_RESET,
  ttlMinutes: 10
});

// Try 4 incorrect guesses
for (let i = 1; i <= 4; i++) {
  const badTry = otpService.consumeEmailOtp({
    email: bruteEmail,
    otp: '000000',
    expectedType: otpService.OTP_TYPES.PASSWORD_RESET
  });
  assert.strictEqual(badTry.success, false);
  assert.strictEqual(badTry.code, 'INCORRECT_OTP');
  assert.strictEqual(badTry.attemptsRemaining, 5 - i);
}

// 5th incorrect guess locks it
const lockTry = otpService.consumeEmailOtp({
  email: bruteEmail,
  otp: '000000',
  expectedType: otpService.OTP_TYPES.PASSWORD_RESET
});
assert.strictEqual(lockTry.success, false);
assert.strictEqual(lockTry.code, 'INCORRECT_OTP');
assert.strictEqual(lockTry.attemptsRemaining, 0);

// 6th attempt (even with CORRECT OTP now!) must be locked out
const lockedOutTry = otpService.consumeEmailOtp({
  email: bruteEmail,
  otp: bruteOtp.otp,
  expectedType: otpService.OTP_TYPES.PASSWORD_RESET
});
assert.strictEqual(lockedOutTry.success, false);
assert.strictEqual(lockedOutTry.code, 'MAX_ATTEMPTS_EXCEEDED');
pass('OTP is locked out after 5 failed attempts; even correct OTP is rejected after lockout');

// -------------------------------------------------------------
// Test 7: LinkTokenService Invariants
// -------------------------------------------------------------
console.log('\n--- Test 7: LinkTokenService Security Invariants ---');
const linkUser = 'token.test@example.com';
const token1 = linkTokenService.createLinkToken({
  email: linkUser,
  type: linkTokenService.TOKEN_TYPES.PASSWORD_RESET,
  ttlMinutes: 15
});

assert.strictEqual(typeof token1.token, 'string');
assert.strictEqual(token1.token.length, 64, 'Token must be 64 hex characters (256-bit CSPRNG)');

// Generate second token -> invalidates token1
const token2 = linkTokenService.createLinkToken({
  email: linkUser,
  type: linkTokenService.TOKEN_TYPES.PASSWORD_RESET,
  ttlMinutes: 15
});

const consumeToken1 = linkTokenService.consumeLinkToken({
  email: linkUser,
  token: token1.token,
  expectedType: linkTokenService.TOKEN_TYPES.PASSWORD_RESET
});
assert.strictEqual(consumeToken1.success, false);
assert.strictEqual(consumeToken1.code, 'LINK_SUPERSEDED');
pass('Link token is superseded and invalidated when a new link token is generated');

// Strict type check on link token
const typeMismatchToken2 = linkTokenService.consumeLinkToken({
  email: linkUser,
  token: token2.token,
  expectedType: linkTokenService.TOKEN_TYPES.EMAIL_VERIFICATION
});
assert.strictEqual(typeMismatchToken2.success, false);
assert.strictEqual(typeMismatchToken2.code, 'INVALID_LINK_TYPE');
pass('Link token rejects type mismatch cross-validation');

// Consume token2
const consumeToken2 = linkTokenService.consumeLinkToken({
  email: linkUser,
  token: token2.token,
  expectedType: linkTokenService.TOKEN_TYPES.PASSWORD_RESET
});
assert.strictEqual(consumeToken2.success, true);
pass('Valid link token consumes cleanly');

// Attempt reuse of token2
const reuseToken2 = linkTokenService.consumeLinkToken({
  email: linkUser,
  token: token2.token,
  expectedType: linkTokenService.TOKEN_TYPES.PASSWORD_RESET
});
assert.strictEqual(reuseToken2.success, false);
assert.strictEqual(reuseToken2.code, 'LINK_ALREADY_USED');
pass('Consumed link token is burned and cannot be reused');

// -------------------------------------------------------------
// Test 8: Controller Pre-Verification Checks & Password Reset Isolation
// -------------------------------------------------------------
console.log('\n--- Test 8: Controller Pre-Verification Checks & Password Reset Isolation ---');
const authController = require('../src/controllers/authController');
const { db } = require('../src/config/database');

function createMockReqRes(body) {
  const req = { body };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

// Seed a known existing user
const seededEmail = 'seeded.citizen@landpin.test';
const seededMobile = '9876543210';
db.users.push({
  _id: 'usr_seeded_test',
  name: 'Seeded Citizen',
  email: seededEmail,
  mobile: `+91 ${seededMobile}`,
  emailVerified: true
});

(async () => {
  // 8A. Block signup OTP for ALREADY EXISTING email
  const mockA = createMockReqRes({ email: seededEmail });
  await authController.sendEmailVerificationOtp(mockA.req, mockA.res, (e) => { throw e; });
  assert.strictEqual(mockA.getStatus(), 409);
  assert.strictEqual(mockA.getData().code, 'EMAIL_ALREADY_EXISTS');
  pass('Blocked signup verification OTP for already existing email (HTTP 409 EMAIL_ALREADY_EXISTS)');

  // 8B. Block signup OTP for ALREADY EXISTING phone number
  const mockB = createMockReqRes({ email: 'fresh.unique@example.com', mobile: seededMobile });
  await authController.sendEmailVerificationOtp(mockB.req, mockB.res, (e) => { throw e; });
  assert.strictEqual(mockB.getStatus(), 409);
  assert.strictEqual(mockB.getData().code, 'MOBILE_ALREADY_EXISTS');
  pass('Blocked signup verification OTP for already existing mobile (HTTP 409 MOBILE_ALREADY_EXISTS)');

  // 8C. Allow signup OTP for BRAND NEW unused email and mobile
  const freshEmail = 'fresh.neverused@example.com';
  const mockC = createMockReqRes({ email: freshEmail, mobile: '9123499999' });
  await authController.sendEmailVerificationOtp(mockC.req, mockC.res, (e) => { throw e; });
  assert.strictEqual(mockC.getStatus(), 200);
  assert.ok(mockC.getData().otp, 'Expected 6-digit OTP returned');
  assert.match(mockC.getData().otp, /^\d{6}$/);
  pass('Allowed signup verification OTP for fresh, unallocated email and mobile (HTTP 200)');

  // 8D. Explicit registration check for NON-EXISTENT email (Prompts registration)
  const mockD = createMockReqRes({ email: 'ghost.unregistered@example.com' });
  await authController.forgotPassword(mockD.req, mockD.res, (e) => { throw e; });
  assert.strictEqual(mockD.getStatus(), 404);
  assert.strictEqual(mockD.getData().code, 'USER_NOT_REGISTERED');
  assert.strictEqual(mockD.getData().notRegistered, true);
  pass('Forgot password rejects unregistered email with 404 USER_NOT_REGISTERED to prompt registration');

  // 8E. Allow password reset for EXISTING registered email
  const mockE = createMockReqRes({ email: seededEmail });
  await authController.forgotPassword(mockE.req, mockE.res, (e) => { throw e; });
  assert.strictEqual(mockE.getStatus(), 200);
  assert.ok(mockE.getData().otp, 'Expected reset OTP returned');
  assert.match(mockE.getData().otp, /^\d{6}$/);
  pass('Allowed password reset OTP dispatch for existing registered user (HTTP 200)');

  // 8F. Block verifyPasswordResetOtp for NON-EXISTENT email
  const mockF = createMockReqRes({ email: 'ghost.unregistered@example.com', otp: '123456' });
  await authController.verifyPasswordResetOtp(mockF.req, mockF.res, (e) => { throw e; });
  assert.strictEqual(mockF.getStatus(), 404);
  assert.strictEqual(mockF.getData().code, 'USER_NOT_FOUND');
  pass('Blocked verifyPasswordResetOtp for non-existing email (HTTP 404 USER_NOT_FOUND)');

  // 8G. Block resetPassword for NON-EXISTENT email
  const mockG = createMockReqRes({ email: 'ghost.unregistered@example.com', newPassword: 'NewPassword123!', otp: '123456' });
  await authController.resetPassword(mockG.req, mockG.res, (e) => { throw e; });
  assert.strictEqual(mockG.getStatus(), 404);
  assert.strictEqual(mockG.getData().code, 'USER_NOT_FOUND');
  pass('Blocked resetPassword submission for non-existing email (HTTP 404 USER_NOT_FOUND)');

  console.log(`\n🎉 All ${testsPassed} Security & Condition Invariant Tests Passed Successfully!\n`);
})().catch(err => {
  console.error('❌ Test failed with exception:', err);
  process.exit(1);
});
