/**
 * Dual-Mode Authentication Middleware
 * Supports Supabase Auth Bearer Tokens and legacy LandPin cryptographic JWTs.
 * Securely resolves the LandPin usr_... citizen profile and strictly prevents privilege escalation.
 */
const jwt = require('jsonwebtoken');
const { db, supabase } = require('../config/database');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_ACCESS_SECRET is required and cannot be empty.');
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        error: "Authentication required. Please provide a valid Bearer token.",
        code: "UNAUTHORIZED"
      });
    }

    let user = null;

    // 1. Try Supabase Auth Token Verification
    try {
      const { data, error: sbError } = await supabase.auth.getUser(token);
      if (!sbError && data && data.user) {
        const authUser = data.user;
        // Find existing LandPin user linked via auth_id
        user = db.users.find(u => u.auth_id === authUser.id);
        
        // JIT link if account exists with matching email
        if (!user && authUser.email) {
          const cleanEmail = authUser.email.toLowerCase().trim();
          user = db.users.find(u => u.email && u.email.toLowerCase().trim() === cleanEmail);
          if (user) {
            user.auth_id = authUser.id;
            await db.updateUser(user._id, { auth_id: authUser.id });
          } else {
            // Check Supabase PostgreSQL database if not currently in memory
            try {
              const { data: dbUser } = await supabase
                .from('users')
                .select('*')
                .or(`auth_id.eq.${authUser.id},email.eq.${cleanEmail}`)
                .maybeSingle();
              if (dbUser) {
                user = {
                  _id: dbUser.id,
                  auth_id: dbUser.auth_id || authUser.id,
                  name: dbUser.name,
                  email: dbUser.email,
                  emailVerified: Boolean(dbUser.email_verified),
                  mobile: dbUser.mobile,
                  mobileVerified: Boolean(dbUser.mobile_verified),
                  accountStatus: dbUser.account_status,
                  roles: dbUser.roles || ['user', 'buyer', 'seller'],
                  activeMode: dbUser.active_mode || 'buyer',
                  preferences: dbUser.preferences,
                  createdAt: new Date(dbUser.created_at),
                  updatedAt: new Date(dbUser.updated_at)
                };
                db.users.push(user);
              }
            } catch (e) {}
          }
        }
      }
    } catch {
      // Supabase verification failed or token is legacy JWT; fall through to legacy check
    }

    // 2. Fallback to Legacy LandPin Application JWT Verification
    if (!user) {
      let legacyUserId = null;
      let decoded = null;
      try {
        decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        legacyUserId = decoded.userId || decoded.sub || decoded.id || decoded._id;
        user = db.users.find(u => (u._id === legacyUserId || u.id === legacyUserId));
        if (!user && legacyUserId) {
          try {
            const { data: dbUser } = await supabase.from('users').select('*').eq('id', legacyUserId).maybeSingle();
            if (dbUser) {
              user = {
                _id: dbUser.id,
                auth_id: dbUser.auth_id,
                name: dbUser.name,
                email: dbUser.email,
                emailVerified: Boolean(dbUser.email_verified),
                mobile: dbUser.mobile,
                mobileVerified: Boolean(dbUser.mobile_verified),
                accountStatus: dbUser.account_status,
                roles: dbUser.roles || ['user', 'buyer', 'seller'],
                activeMode: dbUser.active_mode || 'buyer',
                preferences: dbUser.preferences,
                createdAt: new Date(dbUser.created_at),
                updatedAt: new Date(dbUser.updated_at)
              };
              db.users.push(user);
            }
          } catch {}
        }
      } catch (err) {
        return res.status(401).json({
          error: "Invalid, expired, or malformed authentication token",
          code: "INVALID_TOKEN",
          details: err.name === 'TokenExpiredError' ? 'Token has expired' : 'Signature verification failed'
        });
      }
    }

    if (!user) {
      return res.status(401).json({
        error: "User associated with token no longer exists",
        code: "USER_NOT_FOUND"
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        error: "Your account has been suspended by administration",
        code: "ACCOUNT_SUSPENDED"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication: attaches req.user if a valid token is present,
 * but does not reject anonymous visitors on public endpoints.
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    let user = null;

    try {
      const { data, error: sbError } = await supabase.auth.getUser(token);
      if (!sbError && data && data.user) {
        user = db.users.find(u => u.auth_id === data.user.id || (u.email && u.email.toLowerCase().trim() === data.user.email?.toLowerCase().trim()));
        if (!user && data.user.email) {
          try {
            const { data: dbUser } = await supabase.from('users').select('*').or(`auth_id.eq.${data.user.id},email.eq.${data.user.email.toLowerCase().trim()}`).maybeSingle();
            if (dbUser) {
              user = {
                _id: dbUser.id,
                auth_id: dbUser.auth_id || data.user.id,
                name: dbUser.name,
                email: dbUser.email,
                emailVerified: Boolean(dbUser.email_verified),
                mobile: dbUser.mobile,
                mobileVerified: Boolean(dbUser.mobile_verified),
                accountStatus: dbUser.account_status,
                roles: dbUser.roles || ['user', 'buyer', 'seller'],
                activeMode: dbUser.active_mode || 'buyer',
                preferences: dbUser.preferences,
                createdAt: new Date(dbUser.created_at),
                updatedAt: new Date(dbUser.updated_at)
              };
              db.users.push(user);
            }
          } catch {}
        }
      }
    } catch {
      // Ignore
    }

    if (!user) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const userId = decoded.userId || decoded.sub || decoded.id;
        user = db.users.find(u => u._id === userId);
      } catch {
        user = null;
      }
    }

    req.user = (user && user.accountStatus !== 'suspended') ? user : null;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  JWT_SECRET
};
