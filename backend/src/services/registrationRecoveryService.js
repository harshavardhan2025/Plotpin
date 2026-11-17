/**
 * Registration Recovery & Account Lifecycle Service
 *
 * Implements the 4 Authoritative Account States:
 * - STATE A: NEW_REGISTRATION (New email & mobile, not in DB or Auth)
 * - STATE B: VERIFICATION_REQUIRED (Pending or unverified registration exists, needs OTP)
 * - STATE C: VERIFIED_PROFILE_MISSING (Email verified, LandPin profile missing or incomplete)
 * - STATE D: REGISTRATION_COMPLETE (Email verified, Supabase Auth identity and LandPin profile complete)
 * - CONFLICT: ACCOUNT_CONFLICT (Mobile conflict or identity mismatch)
 *
 * Guarantees:
 * 1. Safe retries - incomplete registrations can be resumed without "Email already exists" lockout.
 * 2. Unverified registrations never block users from receiving new OTPs and finishing signup.
 * 3. Verified emails without profiles are automatically recovered and completed.
 * 4. Passwords are never stored in plaintext (bcrypt hashed).
 * 5. Pending registrations persist to disk so server restarts don't lose user data.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, supabase } = require('../config/database');
const otpService = require('./otpService');
const linkTokenService = require('./linkTokenService');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'property_marketplace_jwt_secret_2026';

const DATA_DIR = path.join(__dirname, '..', 'data');
const PENDING_FILE = path.join(DATA_DIR, 'pending_registrations.json');

// 4 Distinct Account States
const ACCOUNT_STATES = {
  NEW_REGISTRATION: 'NEW_REGISTRATION',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  VERIFIED_PROFILE_MISSING: 'VERIFIED_PROFILE_MISSING',
  REGISTRATION_COMPLETE: 'REGISTRATION_COMPLETE',
  ACCOUNT_CONFLICT: 'ACCOUNT_CONFLICT'
};

// In-memory store of pending registrations backed by disk
const pendingRegistrations = new Map();

// Separate in-memory set for emails verified in the CURRENT SERVER PROCESS SESSION.
// Critically: this is the only in-process state that establishes ownership without a fresh OTP.
// It is intentionally NOT persisted to disk, so server restarts reset it.
// Keys: normalizedEmail, value: { verifiedAt: timestamp, expiresAt: timestamp }
const sessionVerifiedEmails = new Map();

// Session verification TTL: 30 minutes (after this, fresh OTP is required)
const SESSION_VERIFIED_TTL_MS = 30 * 60 * 1000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {}
  }
}

function loadPendingFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(PENDING_FILE)) {
      const raw = fs.readFileSync(PENDING_FILE, 'utf8');
      const data = JSON.parse(raw);
      const now = Date.now();
      pendingRegistrations.clear();
      for (const [email, record] of Object.entries(data)) {
        if (record && record.expiresAt && record.expiresAt > now) {
          pendingRegistrations.set(email.toLowerCase(), record);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [RegistrationRecovery] Failed to load pending registrations from disk:', err.message);
  }
}

function savePendingToDisk() {
  try {
    ensureDataDir();
    const obj = {};
    const now = Date.now();
    for (const [email, record] of pendingRegistrations.entries()) {
      if (record && record.expiresAt && record.expiresAt > now) {
        obj[email] = record;
      }
    }
    fs.writeFileSync(PENDING_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ [RegistrationRecovery] Failed to write pending registrations to disk:', err.message);
  }
}

// Initial load on service startup
loadPendingFromDisk();

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function normalizeMobile(mobile) {
  if (!mobile) return '';
  return String(mobile).replace(/\D/g, '').slice(-10);
}

/**
 * Checks whether a LandPin profile record is complete and fully provisioned
 */
function isProfileComplete(user) {
  if (!user) return false;
  const hasId = Boolean(user._id || user.id);
  const hasEmail = Boolean(user.email);
  const isVerified = Boolean(user.emailVerified || user.email_verified);
  const accountStatus = user.accountStatus || user.account_status;
  const isActive = !accountStatus || accountStatus === 'active';
  const hasIdentity = Boolean(user.name || user.mobile || user.passwordHash || user.password_hash);
  return hasId && hasEmail && isVerified && isActive && hasIdentity;
}

/**
 * Authoritatively determines the account lifecycle state for a given email and optional mobile.
 * Inspects db.users, public.users, Supabase auth.users, and pending registrations.
 *
 * @param {string} email
 * @param {string} [mobile]
 * @returns {Promise<{
 *   state: 'NEW_REGISTRATION'|'VERIFICATION_REQUIRED'|'VERIFIED_PROFILE_MISSING'|'REGISTRATION_COMPLETE'|'ACCOUNT_CONFLICT',
 *   email: string,
 *   user: Object|null,
 *   authUser: Object|null,
 *   pending: Object|null,
 *   conflictReason?: string
 * }>}
 */
/**
 * Authoritatively determines the account lifecycle state for a given email and optional mobile.
 *
 * SECURITY INVARIANT: We ONLY return VERIFIED_PROFILE_MISSING (State C) if the email
 * ownership was proven in the CURRENT server process session within the last 30 minutes
 * via a fresh OTP verification. We do NOT trust:
 *   - pending.emailVerified persisted from a previous session (stale disk state)
 *   - otpService.verifiedEmails which persists for the process lifetime indefinitely
 *   - authUser.email_confirmed_at (this just means Supabase auth account exists, not that
 *     the current requester proved ownership)
 *
 * This prevents both the lockout bug (returning users blocked) AND the security hole
 * (attacker entering someone else's email and getting VERIFIED_PROFILE_MISSING bypass).
 *
 * @param {string} email
 * @param {string} [mobile]
 * @returns {Promise<{...}>}
 */
async function determineAccountState(email, mobile) {
  const cleanEmail = normalizeEmail(email);
  const cleanMobile = normalizeMobile(mobile);

  if (!cleanEmail) {
    throw new Error('Valid email is required to determine account state');
  }

  // 1. Check Completed Profile in Memory
  const localUser = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

  // 2. Check Completed Profile in Supabase public.users
  let dbUser = null;
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();
    dbUser = data;
  } catch (e) {}

  const activeUser = (localUser && isProfileComplete(localUser)) ? localUser :
                     (dbUser && isProfileComplete(dbUser)) ? dbUser : null;

  // 3. Check Supabase Auth identity
  let authUser = null;
  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authData?.users) {
      authUser = authData.users.find(u => u.email && u.email.toLowerCase() === cleanEmail) || null;
    }
  } catch (sbErr) {}

  // If there is no active profile in the database, but an orphan auth record exists,
  // the user was deleted from the database. Clean up the orphan so they can re-register cleanly.
  if (!activeUser && authUser) {
    try {
      await supabase.auth.admin.deleteUser(authUser.id);
      authUser = null;
    } catch {}
  }

  // 4. Check Mobile Conflict
  if (cleanMobile && cleanMobile.length >= 10) {
    const conflictingLocal = db.users.find(u =>
      u.mobile &&
      normalizeMobile(u.mobile) === cleanMobile &&
      u.email &&
      u.email.toLowerCase() !== cleanEmail
    );
    if (conflictingLocal) {
      return {
        state: ACCOUNT_STATES.ACCOUNT_CONFLICT,
        email: cleanEmail,
        user: null,
        authUser: null,
        pending: null,
        conflictReason: 'MOBILE_BELONGS_TO_ANOTHER_ACCOUNT'
      };
    }

    try {
      const { data: conflictingDb } = await supabase
        .from('users')
        .select('*')
        .neq('email', cleanEmail)
        .ilike('mobile', `%${cleanMobile}%`)
        .maybeSingle();

      if (conflictingDb && conflictingDb.email && conflictingDb.email.toLowerCase() !== cleanEmail) {
        return {
          state: ACCOUNT_STATES.ACCOUNT_CONFLICT,
          email: cleanEmail,
          user: null,
          authUser: null,
          pending: null,
          conflictReason: 'MOBILE_BELONGS_TO_ANOTHER_ACCOUNT'
        };
      }
    } catch (e) {}
  }

  // 5. STATE D: Completed Verified Account
  if (activeUser) {
    return {
      state: ACCOUNT_STATES.REGISTRATION_COMPLETE,
      email: cleanEmail,
      user: activeUser,
      authUser,
      pending: null
    };
  }

  // 6. Inspect Pending Registration
  const pending = getPendingRegistration(cleanEmail);

  // 7. STATE C: Email Verified THIS SESSION (fresh, unexpired in-process session only)
  // SECURITY: We intentionally do NOT check:
  //   - pending.emailVerified (stale disk flag, can't prove current requester's ownership)
  //   - otpService.isEmailVerified() (process-lifetime set, never expires)
  //   - authUser.email_confirmed_at (Supabase state, doesn't prove current requester)
  // We ONLY check sessionVerifiedEmails which expires in 30 min and lives in RAM only.
  const hasFreshSessionVerification = isFreshlyVerifiedInSession(cleanEmail);

  if (hasFreshSessionVerification) {
    return {
      state: ACCOUNT_STATES.VERIFIED_PROFILE_MISSING,
      email: cleanEmail,
      user: localUser || dbUser || null,
      authUser,
      pending
    };
  }

  // 8. STATE B or A: Require fresh verification
  // If there is any existing state (pending, auth, profile) but no fresh session verification,
  // treat it as VERIFICATION_REQUIRED so the user gets a new OTP to prove ownership.
  if (pending || authUser || localUser || dbUser) {
    return {
      state: ACCOUNT_STATES.VERIFICATION_REQUIRED,
      email: cleanEmail,
      user: localUser || dbUser || null,
      authUser,
      pending
    };
  }

  // 9. STATE A: Truly new email
  return {
    state: ACCOUNT_STATES.NEW_REGISTRATION,
    email: cleanEmail,
    user: null,
    authUser: null,
    pending: null
  };
}

/**
 * Saves or updates a pending registration with a 24-hour TTL and disk backup.
 * Passwords are hashed with bcrypt before storage; plaintext is NEVER retained.
 */
async function savePendingRegistration({ name, email, mobile, password, preferences }) {
  const cleanEmail = normalizeEmail(email);
  const cleanMobile = normalizeMobile(mobile);
  const now = Date.now();
  const ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  const existing = pendingRegistrations.get(cleanEmail) || {};

  let passwordHash = existing.passwordHash || null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  const record = {
    name: (name && name.trim()) ? name.trim() : (existing.name || cleanEmail.split('@')[0]),
    email: cleanEmail,
    mobile: cleanMobile ? `+91 ${cleanMobile}` : (existing.mobile || ''),
    passwordHash,
    preferences: preferences || existing.preferences || {
      preferredLocations: ['Indiranagar'],
      budgetMin: 0,
      budgetMax: 50000000,
      propertyTypes: ['flat', 'villa'],
      purpose: 'sale'
    },
    emailVerified: existing.emailVerified || false,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    expiresAt: now + ttlMs
  };

  pendingRegistrations.set(cleanEmail, record);
  savePendingToDisk();

  return sanitizePending(record);
}

/**
 * Retrieves an active pending registration record for a given email
 */
function getPendingRegistration(email) {
  const cleanEmail = normalizeEmail(email);
  const record = pendingRegistrations.get(cleanEmail);
  if (!record) return null;

  if (record.expiresAt && record.expiresAt < Date.now()) {
    pendingRegistrations.delete(cleanEmail);
    savePendingToDisk();
    return null;
  }

  return record;
}

/**
 * Marks an email as freshly verified in the current session.
 * Sets a 30-minute expiry. Only this in-session record is used to establish
 * current ownership (not stale disk state or indefinite process-lifetime Sets).
 */
function markEmailVerified(email) {
  const cleanEmail = normalizeEmail(email);
  const now = Date.now();

  // Record in short-lived session map (30 min TTL, RAM only)
  sessionVerifiedEmails.set(cleanEmail, {
    verifiedAt: now,
    expiresAt: now + SESSION_VERIFIED_TTL_MS
  });

  // Also update the pending registration disk record so the frontend
  // state machine can reflect 'verified' status.
  const pending = pendingRegistrations.get(cleanEmail);
  if (pending) {
    pending.emailVerified = true;
    pending.emailVerifiedAt = now;
    pending.updatedAt = now;
    // Keep the pending record alive for at least 30 more minutes so resumption works
    if (pending.expiresAt - now < SESSION_VERIFIED_TTL_MS) {
      pending.expiresAt = now + SESSION_VERIFIED_TTL_MS;
    }
    savePendingToDisk();
  }

  // Forward to otpService so existing code paths that call isEmailVerified() still work
  // (but determineAccountState no longer relies on otpService.isEmailVerified)
  otpService.markEmailVerified(cleanEmail);
  linkTokenService.markEmailVerified(cleanEmail);
}

/**
 * Checks whether a fresh in-session verification exists for this email
 * (within the 30-minute session window).
 * This is the ONLY function determineAccountState uses to establish State C.
 */
function isFreshlyVerifiedInSession(email) {
  const cleanEmail = normalizeEmail(email);
  const record = sessionVerifiedEmails.get(cleanEmail);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    sessionVerifiedEmails.delete(cleanEmail);
    return false;
  }
  return true;
}

/**
 * Clears the session verification for an email.
 * Called when registration completes (State D), or when we want to force
 * the user to re-verify (e.g., admin action, security event).
 */
function clearSessionVerification(email) {
  const cleanEmail = normalizeEmail(email);
  sessionVerifiedEmails.delete(cleanEmail);
  // Also clear the pending emailVerified flag so disk state is consistent
  const pending = pendingRegistrations.get(cleanEmail);
  if (pending) {
    pending.emailVerified = false;
    pending.updatedAt = Date.now();
    savePendingToDisk();
  }
}

/**
 * Atomically cleans up a pending registration once registration completes
 */
function removePendingRegistration(email) {
  const cleanEmail = normalizeEmail(email);
  pendingRegistrations.delete(cleanEmail);
  savePendingToDisk();
}

/**
 * Sanitizes pending registration record (removes passwordHash)
 */
function sanitizePending(record) {
  if (!record) return null;
  const { passwordHash, ...safe } = record;
  return safe;
}

/**
 * Idempotently provisions Supabase Auth user & LandPin Profile in public.users + db.users.
 * Safely recovers incomplete registrations without duplicates.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} [params.name]
 * @param {string} [params.mobile]
 * @param {string} [params.password]
 * @param {Object} [params.preferences]
 * @returns {Promise<{ user: Object, token: string }>}
 */
async function completeAccountProvisioning({ email, name, mobile, password, preferences }) {
  const cleanEmail = normalizeEmail(email);
  const rawMobile = mobile || '';
  const cleanMobile = normalizeMobile(rawMobile);

  const pending = getPendingRegistration(cleanEmail);

  const displayName = (name && name.trim()) ? name.trim() : 
                      (pending?.name) ? pending.name : 
                      cleanEmail.split('@')[0];

  const formattedMobile = cleanMobile ? `+91 ${cleanMobile}` : 
                          (pending?.mobile) ? pending.mobile : 
                          '+91 9845049120';

  // 1. Password resolution (Provided password > Pending passwordHash > Fallback hash)
  let passwordHash = null;
  if (password && password.length >= 6) {
    passwordHash = await bcrypt.hash(password, 10);
  } else if (pending?.passwordHash) {
    passwordHash = pending.passwordHash;
  } else {
    passwordHash = await bcrypt.hash('PlotPinCitizen2026!', 10);
  }

  // 2. Supabase Auth Provisioning / Updating
  let authUser = null;
  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authData?.users) {
      authUser = authData.users.find(u => u.email && u.email.toLowerCase() === cleanEmail) || null;
    }
  } catch (e) {}

  if (authUser) {
    try {
      const updatePayload = {
        email_confirm: true,
        user_metadata: {
          name: displayName,
          mobile: formattedMobile
        }
      };
      if (password && password.length >= 6) {
        updatePayload.password = password;
      }
      await supabase.auth.admin.updateUserById(authUser.id, updatePayload);
    } catch (updErr) {
      console.warn('⚠️ [RegistrationRecovery] updateUserById warning:', updErr.message);
    }
  } else {
    try {
      const { data: newAuth, error: crError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password || 'PlotPinCitizen2026!',
        email_confirm: true,
        user_metadata: {
          name: displayName,
          mobile: formattedMobile
        }
      });
      if (newAuth?.user) {
        authUser = newAuth.user;
      } else if (crError) {
        // If user already exists in auth, find and update password
        const { data: allAuth } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existingAuth = allAuth?.users?.find(u => u.email && u.email.toLowerCase() === cleanEmail);
        if (existingAuth) {
          authUser = existingAuth;
          if (password && password.length >= 6) {
            await supabase.auth.admin.updateUserById(existingAuth.id, {
              password,
              email_confirm: true,
              user_metadata: { name: displayName, mobile: formattedMobile }
            });
          }
        }
      }
    } catch (crErr) {
      console.warn('⚠️ [RegistrationRecovery] createUser warning:', crErr.message);
    }
  }

  const authId = authUser ? authUser.id : null;

  // 3. Find or Create LandPin Profile Record
  let existingUser = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

  const finalPreferences = preferences || pending?.preferences || {
    preferredLocations: ['Indiranagar'],
    budgetMin: 0,
    budgetMax: 50000000,
    propertyTypes: ['flat', 'villa'],
    purpose: 'sale'
  };

  const userId = existingUser?._id || db.generateId('usr');

  const provisionedUser = {
    _id: userId,
    auth_id: authId,
    name: displayName,
    email: cleanEmail,
    emailVerified: true,
    mobile: formattedMobile,
    mobileVerified: false,
    passwordHash,
    accountStatus: 'active',
    roles: existingUser?.roles || ['user', 'buyer', 'seller'],
    activeMode: existingUser?.activeMode || 'buyer',
    preferences: finalPreferences,
    createdAt: existingUser?.createdAt || new Date(),
    updatedAt: new Date()
  };

  // 4. Update in-memory DB and Supabase public.users
  await db.insertUser(provisionedUser);

  // 5. Remove pending registration and clear session verification on completed provisioning
  removePendingRegistration(cleanEmail);
  clearSessionVerification(cleanEmail);

  // 6. Sign JWT Session Token
  const token = jwt.sign(
    { userId: provisionedUser._id, roles: provisionedUser.roles },
    JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );

  const { passwordHash: _, ...safeUser } = provisionedUser;

  return {
    user: safeUser,
    token
  };
}

module.exports = {
  ACCOUNT_STATES,
  determineAccountState,
  savePendingRegistration,
  getPendingRegistration,
  markEmailVerified,
  isFreshlyVerifiedInSession,
  clearSessionVerification,
  removePendingRegistration,
  completeAccountProvisioning,
  normalizeEmail,
  normalizeMobile,
  isProfileComplete
};
