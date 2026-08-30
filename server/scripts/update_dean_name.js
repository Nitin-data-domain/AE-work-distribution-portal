const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(
      `UPDATE users SET name = 'Mr. Deepak Dhalla Sir' WHERE LOWER(email) = 'nitingirdhar521@gmail.com' OR (role = 'Dean' AND user_id = 11) RETURNING user_id, name, email, role`
    );
    console.log('✅ Dean Name Updated:');
    console.table(res.rows);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
