// ============================================================
// College Grievance Portal — Database Connection Pool (MySQL & Postgres)
// ============================================================
require('dotenv').config();

// Check if using PostgreSQL (e.g., Neon or standard PG)
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const { Pool: NeonPool, neonConfig } = require('@neondatabase/serverless');
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;

  const pgPool = new NeonPool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  pgPool.on('connect', () => {
    if (process.env.NODE_ENV !== 'production') console.log('🗄️ PostgreSQL connected');
  });

  module.exports = pgPool;
} else {
  // Use MySQL (GoDaddy Managed MySQL / standard MySQL)
  const mysql = require('mysql2/promise');

  const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('🗄️ MySQL Connection Pool initialized');
  }

  module.exports = {
    query: async (sqlText, params = []) => {
      // Convert PostgreSQL $1, $2 positional placeholders to MySQL ? syntax
      let formattedSql = sqlText;
      let paramIndex = 1;
      while (formattedSql.includes(`$${paramIndex}`)) {
        formattedSql = formattedSql.replace(`$${paramIndex}`, '?');
        paramIndex++;
      }

      const [results] = await mysqlPool.execute(formattedSql, params);
      const rows = Array.isArray(results) ? results : (results ? [results] : []);
      return { rows, insertId: results.insertId, affectedRows: results.affectedRows };
    }
  };
}


