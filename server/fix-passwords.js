const bcrypt = require('bcryptjs');
const pool = require('./src/config/db');

async function fix() {
  const hash = await bcrypt.hash('Admin@1234', 10);
  const res = await pool.query('UPDATE users SET password = $1', [hash]);
  console.log(`✅ Updated ${res.rowCount} users with password: Admin@1234`);
  await pool.end();
}
fix().catch(err => console.error(err));

