/**
 * Script to clear all data rows from Supabase database while strictly preserving table schemas.
 * Tables cleared:
 * 1. appointments
 * 2. audit_logs
 * 3. inquiries
 * 4. support_tickets
 * 5. properties
 * 6. users
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function clearTable(tableName, idCol = 'id') {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .delete()
      .neq(idCol, '___placeholder_preserve_none___');

    if (error) {
      console.warn(`Warning clearing ${tableName}:`, error.message);
      return false;
    }
    console.log(`✅ Cleared all rows from table: ${tableName}`);
    return true;
  } catch (err) {
    console.error(`Error clearing ${tableName}:`, err.message);
    return false;
  }
}

async function verifyCounts() {
  const tables = ['appointments', 'audit_logs', 'inquiries', 'support_tickets', 'properties', 'users'];
  console.log('\n--- Verifying Row Counts in Supabase ---');
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ${t}: [Not present or error: ${error.message}]`);
    } else {
      console.log(`  ${t}: ${count} rows`);
    }
  }
}

async function run() {
  console.log('====================================================');
  console.log('🗑️  LANDPIN DATABASE WIPE — CLEARING DATA ROWS');
  console.log('====================================================\n');

  // Delete in foreign-key dependency order:
  // 1. Child tables referencing properties and users
  console.log('Step 1: Clearing transactional child tables...');
  await clearTable('appointments');
  await clearTable('audit_logs');
  await clearTable('inquiries');
  await clearTable('support_tickets');

  // 2. Clear properties (references users)
  console.log('\nStep 2: Clearing properties table...');
  await clearTable('properties');

  // 3. Clear users
  console.log('\nStep 3: Clearing users table...');
  await clearTable('users');

  // 4. Clear Supabase Auth users
  console.log('\nStep 4: Clearing Supabase Auth users...');
  try {
    const { data: authData } = await supabase.auth.admin.listUsers();
    if (authData?.users?.length > 0) {
      for (const u of authData.users) {
        await supabase.auth.admin.deleteUser(u.id);
      }
      console.log(`✅ Cleared ${authData.users.length} Supabase Auth users`);
    } else {
      console.log('✅ No Supabase Auth users to clear');
    }
  } catch (authErr) {
    console.warn('Notice clearing auth users:', authErr.message);
  }

  await verifyCounts();

  console.log('\n====================================================');
  console.log('✅ DATABASE DATA WIPE COMPLETE (SCHEMAS PRESERVED)');
  console.log('====================================================');
}

run().catch(console.error);
