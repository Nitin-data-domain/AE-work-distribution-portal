// Fix: Deactivate all test/fake accounts with invalid emails
// This prevents "Address not found" bounce-back emails
require('dotenv').config();
const pool = require('./src/config/db');

async function fix() {
  // Deactivate accounts with fake @college.edu, @university.edu, @example.com emails
  const result = await pool.query(`
    UPDATE users SET is_active = false 
    WHERE email LIKE '%@college.edu' 
       OR email LIKE '%@university.edu' 
       OR email LIKE '%@example.com'
    RETURNING user_id, name, email, role
  `);
  
  console.log(`\n✅ Deactivated ${result.rows.length} fake accounts:`);
  for (const u of result.rows) {
    console.log(`   ❌ [${u.role}] ${u.name} <${u.email}>`);
  }

  // Also deactivate the duplicate inactive HOD (user_id 1)
  await pool.query(`UPDATE users SET is_active = false WHERE user_id = 1 AND is_active = false`);
  
  // Show remaining active accounts
  const active = await pool.query(`
    SELECT user_id, name, email, role FROM users WHERE is_active = true ORDER BY role, user_id
  `);
  
  console.log(`\n📋 Active accounts (${active.rows.length}):`);
  for (const u of active.rows) {
    console.log(`   ✅ [${u.role}] ${u.name} <${u.email}>`);
  }
  
  console.log('\n✅ Done! Fake accounts will no longer receive notification emails.\n');
  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });
