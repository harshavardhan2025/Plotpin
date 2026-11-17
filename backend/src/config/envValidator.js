/**
 * Environment Configuration Validator
 * Validates presence of critical variables at application startup without exposing secret values.
 */
function validateEnv() {
  const required = [
    'JWT_ACCESS_SECRET',
    'SUPABASE_URL'
  ];

  const missing = [];
  for (const key of required) {
    if (!process.env[key] || process.env[key].trim() === '') {
      missing.push(key);
    }
  }

  const hasSupabaseKey = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasSupabaseKey) {
    missing.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
  }

  if (missing.length > 0) {
    console.error(`🚨 FATAL: Application startup aborted. Missing critical required environment secrets: ${missing.join(', ')}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }

  return {
    valid: missing.length === 0,
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000
  };
}

module.exports = { validateEnv };
