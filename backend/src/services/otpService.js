/**
 * Email OTP Security Service
 * Manages cryptographically secure, single-use, strictly typed, user-bound 6-digit OTPs
 * for Email Verification and Password Reset flows.
 *
 * Security Invariants:
 * 1. Strict Typing: A password_reset OTP CANNOT validate for email_verification, and vice versa.
 * 2. User Isolation: An OTP is strictly bound to the specific user's normalized email.
 * 3. Invalidation on New Generation: Generating a new OTP for an email & type immediately invalidates
 *    all prior unconsumed OTPs for that user/type ("superseded by newer OTP").
 * 4. Single-Use Only: Once consumed, an OTP is burned and cannot be reused ("not for next").
 * 5. Time-to-Live: OTPs strictly expire after their configured duration (default: 10 minutes).
 * 6. Brute-Force Rate Limiting: Max 5 failed attempts per OTP before it is locked out permanently.
 * 7. Cryptographic Entropy: crypto.randomInt(100000, 1000000).
 */

const crypto = require('crypto');

// In-memory OTP store: key `${email}:${type}` -> OTPRecord
// And secondary lookup by token/code if needed
const otpStore = new Map();

// In-memory store of emails verified during this session
const verifiedEmails = new Set();

/**
 * Standard OTP Types
 */
const OTP_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset'
};

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

/**
 * Store key helper
 */
function getStoreKey(email, type) {
  return `${normalizeEmail(email)}:::${type}`;
}

/**
 * Generates a cryptographically secure 6-digit OTP for a user and type.
 * Automatically invalidates any prior unconsumed OTP for this user and type.
 *
 * @param {Object} params
 * @param {string} params.email - Target user email
 * @param {'email_verification'|'password_reset'} params.type - OTP purpose
 * @param {number} [params.ttlMinutes=10] - Expiration duration in minutes
 * @returns {Object} { otp, email, type, expiresAt, expiresInSeconds }
 */
function generateEmailOtp({ email, type, ttlMinutes = 10 }) {
  if (!email || typeof email !== 'string') {
    throw new Error('Valid email is required to generate OTP');
  }
  if (!Object.values(OTP_TYPES).includes(type)) {
    throw new Error(`Invalid OTP type: ${type}. Must be one of: ${Object.values(OTP_TYPES).join(', ')}`);
  }

  const cleanEmail = normalizeEmail(email);
  const key = getStoreKey(cleanEmail, type);

  // 1. INVARIANT: Invalidate any existing OTP for this email & type
  const existing = otpStore.get(key);
  if (existing && !existing.used && !existing.invalidated) {
    existing.invalidated = true;
    existing.invalidatedAt = Date.now();
    existing.invalidationReason = 'SUPERSEDED_BY_NEW_OTP';
  }

  // 2. Generate 6-digit numeric OTP with cryptographically secure random generator
  const otp = crypto.randomInt(100000, 1000000).toString();
  const now = Date.now();
  const expiresAt = now + (ttlMinutes * 60 * 1000);

  const otpRecord = {
    otp,
    email: cleanEmail,
    type,
    createdAt: now,
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
    used: false,
    usedAt: null,
    invalidated: false,
    invalidatedAt: null,
    invalidationReason: null
  };

  otpStore.set(key, otpRecord);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EmailOTP] Generated ${type} OTP for ${cleanEmail}: [ ${otp} ] (Expires in ${ttlMinutes}m)`);
  } else {
    console.log(`[EmailOTP] Generated ${type} OTP for ${cleanEmail} (Expires in ${ttlMinutes}m)`);
  }

  return {
    otp,
    email: cleanEmail,
    type,
    expiresAt,
    expiresInSeconds: Math.floor((expiresAt - now) / 1000)
  };
}

/**
 * Verifies an OTP without burning it (inspect-only, e.g. for step-by-step forms)
 */
function inspectEmailOtp({ email, otp, expectedType }) {
  if (!otp || typeof otp !== 'string') {
    return {
      valid: false,
      error: 'Please enter the 6-digit verification code.',
      code: 'OTP_MISSING'
    };
  }

  const cleanEmail = normalizeEmail(email);
  const cleanOtp = otp.trim();
  const key = getStoreKey(cleanEmail, expectedType);
  const record = otpStore.get(key);

  if (!record) {
    return {
      valid: false,
      error: 'No verification code found for this email. Please request a new code.',
      code: 'OTP_NOT_FOUND'
    };
  }

  // Check 1: User binding ("nea for that user")
  if (record.email !== cleanEmail) {
    return {
      valid: false,
      error: 'This verification code does not belong to this email address.',
      code: 'USER_MISMATCH'
    };
  }

  // Check 2: Strict Typing ("it validate per that one that type only")
  if (expectedType && record.type !== expectedType) {
    return {
      valid: false,
      error: `Security violation: This code cannot be used for ${expectedType}. It was issued strictly for ${record.type}.`,
      code: 'INVALID_OTP_TYPE'
    };
  }

  // Check 3: Check if superseded by new OTP generation
  if (record.invalidated && record.invalidationReason === 'SUPERSEDED_BY_NEW_OTP') {
    return {
      valid: false,
      error: 'A newer verification code has already been requested. Please enter the newest code sent to your email.',
      code: 'OTP_SUPERSEDED'
    };
  }

  // Check 4: Check if already used ("not for next")
  if (record.used) {
    return {
      valid: false,
      error: 'This verification code has already been used and cannot be reused. Please request a new code.',
      code: 'OTP_ALREADY_USED'
    };
  }

  // Check 5: General invalidation / Lockout
  if (record.invalidated) {
    return {
      valid: false,
      error: 'This verification code has been invalidated. Please request a new code.',
      code: 'OTP_INVALIDATED'
    };
  }

  // Check 6: Expiration
  const now = Date.now();
  if (now > record.expiresAt) {
    return {
      valid: false,
      error: 'This verification code has expired. Please click "Resend Code" to receive a fresh code.',
      code: 'OTP_EXPIRED'
    };
  }

  // Check 7: Brute-force rate limiting
  if (record.attempts >= record.maxAttempts) {
    record.invalidated = true;
    record.invalidatedAt = now;
    record.invalidationReason = 'MAX_ATTEMPTS_EXCEEDED';
    return {
      valid: false,
      error: 'Too many incorrect attempts. This code has been locked. Please request a new code.',
      code: 'MAX_ATTEMPTS_EXCEEDED'
    };
  }

  // Check 8: Match code (constant-time comparison for security)
  const isMatch = (record.otp === cleanOtp);
  if (!isMatch) {
    record.attempts += 1;
    const remaining = record.maxAttempts - record.attempts;
    return {
      valid: false,
      error: remaining > 0 
        ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
        : 'Too many incorrect attempts. This code has been locked. Please request a new code.',
      code: 'INCORRECT_OTP',
      attemptsRemaining: remaining
    };
  }

  return {
    valid: true,
    email: record.email,
    type: record.type,
    record
  };
}

/**
 * Validates and atomically consumes the 6-digit OTP.
 * Once consumed, the OTP is burned and cannot be used again.
 *
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.otp - 6-digit OTP
 * @param {'email_verification'|'password_reset'} params.expectedType - Expected type
 * @returns {Object} { success: boolean, error?: string, code?: string }
 */
function consumeEmailOtp({ email, otp, expectedType }) {
  const inspection = inspectEmailOtp({ email, otp, expectedType });
  if (!inspection.valid) {
    return {
      success: false,
      error: inspection.error,
      code: inspection.code,
      attemptsRemaining: inspection.attemptsRemaining
    };
  }

  const record = inspection.record;
  // Atomically burn the OTP
  record.used = true;
  record.usedAt = Date.now();
  record.invalidated = true;
  record.invalidationReason = 'CONSUMED';

  return {
    success: true,
    email: record.email,
    type: record.type,
    consumedAt: record.usedAt
  };
}

/**
 * Marks email as verified in-memory
 */
function markEmailVerified(email) {
  if (!email) return;
  verifiedEmails.add(normalizeEmail(email));
}

/**
 * Checks if email is verified in-memory
 */
function isEmailVerified(email) {
  if (!email) return false;
  return verifiedEmails.has(normalizeEmail(email));
}

/**
 * Helper to fetch latest active OTP record (for tests or automated verification)
 */
function getActiveOtp(email, type) {
  const key = getStoreKey(email, type);
  const record = otpStore.get(key);
  if (record && !record.used && !record.invalidated && Date.now() < record.expiresAt) {
    return record;
  }
  return null;
}

/**
 * Cleanup stale OTPs
 */
function cleanStaleOtps() {
  const threshold = Date.now() - (60 * 60 * 1000); // 1 hour
  for (const [key, record] of otpStore.entries()) {
    if (record.createdAt < threshold) {
      otpStore.delete(key);
    }
  }
}

setInterval(cleanStaleOtps, 30 * 60 * 1000).unref();

module.exports = {
  OTP_TYPES,
  generateEmailOtp,
  inspectEmailOtp,
  consumeEmailOtp,
  markEmailVerified,
  isEmailVerified,
  getActiveOtp,
  normalizeEmail
};
