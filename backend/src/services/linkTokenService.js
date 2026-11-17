/**
 * Link Token Security Service
 * Manages cryptographically secure, single-use, strictly typed, user-bound tokens
 * for Email Verification and Password Reset flows.
 *
 * Security Invariants:
 * 1. Strict Typing: A password_reset token CANNOT validate for email_verification, and vice versa.
 * 2. User Isolation: A token is strictly bound to the specific user's normalized email.
 * 3. Invalidation on New Generation: Generating a new link for an email & type immediately invalidates
 *    all prior unconsumed tokens for that user/type ("superseded by newer link").
 * 4. Single-Use Only: Once consumed, a token is burned and cannot be reused ("not for next").
 * 5. Time-to-Live: Tokens strictly expire after their configured duration (e.g. 15 min for reset, 30 min for verify).
 * 6. Cryptographic Entropy: 256-bit CSPRNG tokens (crypto.randomBytes(32)).
 */

const crypto = require('crypto');

// In-memory token storage (Map: tokenString -> TokenRecord)
const tokenStore = new Map();

// In-memory store of emails verified during this lifecycle
const verifiedEmails = new Set();

/**
 * Standard Token Types
 */
const TOKEN_TYPES = {
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification'
};

/**
 * Normalizes email for case-insensitive matching
 */
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

/**
 * Generates a high-entropy cryptographically secure token.
 * Invalidates any existing unconsumed tokens of the same type for this user.
 *
 * @param {Object} params
 * @param {string} params.email - Target user email
 * @param {'password_reset'|'email_verification'} params.type - Token type
 * @param {number} [params.ttlMinutes=15] - Expiration duration in minutes
 * @returns {Object} { token, expiresAt, type, email }
 */
function createLinkToken({ email, type, ttlMinutes = 15 }) {
  if (!email || typeof email !== 'string') {
    throw new Error('Valid email is required to generate link token');
  }
  if (!Object.values(TOKEN_TYPES).includes(type)) {
    throw new Error(`Invalid token type: ${type}. Must be one of: ${Object.values(TOKEN_TYPES).join(', ')}`);
  }

  const cleanEmail = normalizeEmail(email);

  // 1. INVARIANT: Invalidate any previous unconsumed tokens for this user & type
  // "make that some more secure that links verify every time at new link generation"
  for (const [existingToken, record] of tokenStore.entries()) {
    if (record.email === cleanEmail && record.type === type && !record.used && !record.invalidated) {
      record.invalidated = true;
      record.invalidatedAt = Date.now();
      record.invalidationReason = 'SUPERSEDED_BY_NEW_LINK';
    }
  }

  // 2. Generate 256-bit cryptographically secure random token (64 hex characters)
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + (ttlMinutes * 60 * 1000);

  const tokenRecord = {
    token,
    email: cleanEmail,
    type,
    createdAt: now,
    expiresAt,
    used: false,
    usedAt: null,
    invalidated: false,
    invalidatedAt: null,
    invalidationReason: null
  };

  tokenStore.set(token, tokenRecord);

  return {
    token,
    email: cleanEmail,
    type,
    expiresAt,
    expiresInSeconds: Math.floor((expiresAt - now) / 1000)
  };
}

/**
 * Inspects a link token without consuming it (useful for link landing verification).
 *
 * @param {Object} params
 * @param {string} params.email - Claimed email
 * @param {string} params.token - Token string
 * @param {string} params.expectedType - Expected token type
 * @returns {Object} { valid: boolean, error?: string, code?: string, record?: Object }
 */
function inspectLinkToken({ email, token, expectedType }) {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Security token is missing or malformed',
      code: 'TOKEN_MISSING'
    };
  }

  const cleanEmail = normalizeEmail(email);
  const record = tokenStore.get(token.trim());

  if (!record) {
    return {
      valid: false,
      error: 'This security link is invalid or unrecognized. Please request a new link.',
      code: 'TOKEN_NOT_FOUND'
    };
  }

  // Check 1: User binding ("nea for that user")
  if (cleanEmail && record.email !== cleanEmail) {
    return {
      valid: false,
      error: 'This link was not issued for this email address.',
      code: 'USER_MISMATCH'
    };
  }

  // Check 2: Strict Typing ("it validate per that one that type only")
  if (expectedType && record.type !== expectedType) {
    return {
      valid: false,
      error: `Security violation: This link cannot be used for ${expectedType}. It is designated strictly for ${record.type}.`,
      code: 'INVALID_LINK_TYPE'
    };
  }

  // Check 3: Check if superseded by new link generation
  if (record.invalidated && record.invalidationReason === 'SUPERSEDED_BY_NEW_LINK') {
    return {
      valid: false,
      error: 'A newer link was generated after this one. Please use the latest link sent to your email.',
      code: 'LINK_SUPERSEDED'
    };
  }

  // Check 4: Check if already used ("not for next")
  if (record.used) {
    return {
      valid: false,
      error: 'This security link has already been used and cannot be reused. Please request a new link if needed.',
      code: 'LINK_ALREADY_USED'
    };
  }

  // Check 5: General invalidation
  if (record.invalidated) {
    return {
      valid: false,
      error: 'This security link has been invalidated. Please request a new link.',
      code: 'LINK_INVALIDATED'
    };
  }

  // Check 6: Expiration
  const now = Date.now();
  if (now > record.expiresAt) {
    return {
      valid: false,
      error: 'This security link has expired. For your security, links are only valid for a limited time.',
      code: 'LINK_EXPIRED'
    };
  }

  return {
    valid: true,
    email: record.email,
    type: record.type,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    expiresInSeconds: Math.max(0, Math.floor((record.expiresAt - now) / 1000)),
    record
  };
}

/**
 * Validates and consumes a link token in a single atomic step.
 * Once consumed, the token can NEVER be used again.
 *
 * @param {Object} params
 * @param {string} params.email - Claimed email
 * @param {string} params.token - Token string
 * @param {string} params.expectedType - Expected token type
 * @returns {Object} { success: boolean, email?: string, type?: string, error?: string, code?: string }
 */
function consumeLinkToken({ email, token, expectedType }) {
  const inspection = inspectLinkToken({ email, token, expectedType });
  if (!inspection.valid) {
    return {
      success: false,
      error: inspection.error,
      code: inspection.code
    };
  }

  const record = inspection.record;
  // Atomically mark used & burned
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
 * Mark an email as verified in the verifiedEmails cache
 */
function markEmailVerified(email) {
  if (!email) return;
  verifiedEmails.add(normalizeEmail(email));
}

/**
 * Check if an email is marked as verified in memory
 */
function isEmailVerifiedInMemory(email) {
  if (!email) return false;
  return verifiedEmails.has(normalizeEmail(email));
}

/**
 * Returns latest active token for an email & type (primarily for automated testing)
 */
function getActiveToken(email, type) {
  const cleanEmail = normalizeEmail(email);
  for (const record of tokenStore.values()) {
    if (record.email === cleanEmail && record.type === type && !record.used && !record.invalidated && Date.now() < record.expiresAt) {
      return record;
    }
  }
  return null;
}

/**
 * Periodic cleanup of stale tokens older than 24 hours
 */
function cleanStaleTokens() {
  const threshold = Date.now() - (24 * 60 * 60 * 1000);
  for (const [token, record] of tokenStore.entries()) {
    if (record.createdAt < threshold) {
      tokenStore.delete(token);
    }
  }
}

// Sweep every hour
setInterval(cleanStaleTokens, 60 * 60 * 1000).unref();

module.exports = {
  TOKEN_TYPES,
  createLinkToken,
  inspectLinkToken,
  consumeLinkToken,
  markEmailVerified,
  isEmailVerifiedInMemory,
  getActiveToken,
  normalizeEmail
};
