const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // 1. Rename student with nitingirdhar521@gmail.com
    await pool.query(`UPDATE users SET email = 'student_nitin@aharadaedu.in' WHERE LOWER(email) = 'nitingirdhar521@gmail.com'`);
    
    // 2. Set Dean email for user_id = 11
    await pool.query(`UPDATE users SET email = 'nitingirdhar521@gmail.com' WHERE user_id = 11 OR LOWER(email) = 'nitin521@gmail.com'`);

    const check = await pool.query(
      `SELECT user_id, name, email, role FROM users WHERE role IN ('Dean', 'HOD', 'Faculty')`
    );
    console.log('✅ Staff Credentials Updated:');
    console.table(check.rows);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
