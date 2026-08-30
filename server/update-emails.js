const { Pool } = require('pg');
require('dotenv').config();

async function updateTestEmails() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Update existing conflict emails to temp
  await pool.query("UPDATE users SET email = 'old_' || user_id || '_' || email WHERE email IN ('nitin521@gmail.com', 'somya@aharadaedu.in', 'nitin@aharadaedu.in') AND user_id NOT IN (11, 12, 14)");

  // Update Dean
  await pool.query("UPDATE users SET email = 'nitin521@gmail.com' WHERE user_id = 11");
  console.log('✅ Dean email updated to nitin521@gmail.com');

  // Update HOD
  await pool.query("UPDATE users SET email = 'somya@aharadaedu.in' WHERE user_id = 12");
  console.log('✅ HOD email updated to somya@aharadaedu.in');

  // Update Faculty
  await pool.query("UPDATE users SET email = 'nitin@aharadaedu.in' WHERE user_id = 14");
  console.log('✅ Faculty email updated to nitin@aharadaedu.in');

  await pool.end();
}

updateTestEmails().catch(console.error);
