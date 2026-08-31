// List all users using the proper db config (supports Neon WebSocket)
require('dotenv').config();
const pool = require('./src/config/db');

async function main() {
  const result = await pool.query(
    `SELECT user_id, name, email, role, is_active FROM users ORDER BY role, user_id`
  );
  
  console.log('\n📋 ALL USERS IN DATABASE:');
  console.log('─'.repeat(90));
  console.log('ID'.padEnd(6) + 'Role'.padEnd(10) + 'Name'.padEnd(25) + 'Email'.padEnd(35) + 'Active');
  console.log('─'.repeat(90));
  
  for (const u of result.rows) {
    const emailStatus = (u.email.includes('@college.edu') || u.email.startsWith('old_')) ? ' ⚠️ FAKE' : '';
    console.log(
      String(u.user_id).padEnd(6) +
      u.role.padEnd(10) +
      (u.name || '').substring(0, 24).padEnd(25) +
      (u.email || '').substring(0, 34).padEnd(35) +
      (u.is_active ? '✅' : '❌') +
      emailStatus
    );
  }
  
  console.log('─'.repeat(90));
  console.log(`Total: ${result.rows.length} users\n`);
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
