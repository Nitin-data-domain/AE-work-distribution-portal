// ============================================================
// College Grievance Portal — Dual Database Connection Pool (MySQL & Postgres)
// Handles query conversion and RETURNING clauses for MySQL compatibility
// ============================================================
require('dotenv').config();

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
      // 1. Convert PostgreSQL $1, $2 positional placeholders to MySQL ? syntax
      let formattedSql = sqlText;
      let paramIndex = 1;
      while (formattedSql.includes(`$${paramIndex}`)) {
        formattedSql = formattedSql.replace(`$${paramIndex}`, '?');
        paramIndex++;
      }

      // 2. Handle RETURNING clause for MySQL compatibility
      const returningMatch = formattedSql.match(/RETURNING\s+([\s\S]+)$/i);
      if (returningMatch) {
        formattedSql = formattedSql.replace(/RETURNING\s+[\s\S]+$/i, '').trim();
      }

      // 3. Handle Postgres 'NOT is_active' boolean flip syntax for MySQL
      formattedSql = formattedSql.replace(/NOT\s+is_active/gi, 'NOT(is_active)');

      const [results] = await mysqlPool.execute(formattedSql, params);
      
      let rows = Array.isArray(results) ? results : [];

      if (!Array.isArray(results) && returningMatch) {
        // If it was an INSERT with RETURNING
        if (results.insertId) {
          const tableMatch = sqlText.match(/INSERT\s+INTO\s+([^\s(]+)/i);
          if (tableMatch) {
            const tableName = tableMatch[1].toLowerCase();
            const pkField = tableName === 'users' ? 'user_id' : (tableName === 'grievances' ? 'grievance_id' : 'history_id');
            const [inserted] = await mysqlPool.execute(`SELECT * FROM ${tableName} WHERE ${pkField} = ?`, [results.insertId]);
            rows = inserted;
          }
        } 
        // If it was an UPDATE with RETURNING
        else if (results.affectedRows > 0) {
          const tableMatch = sqlText.match(/UPDATE\s+([^\s]+)/i);
          if (tableMatch) {
            const tableName = tableMatch[1].toLowerCase();
            const pkField = tableName === 'users' ? 'user_id' : (tableName === 'grievances' ? 'grievance_id' : 'history_id');
            const lastParam = params[params.length - 1];
            if (lastParam !== undefined) {
              const [updated] = await mysqlPool.execute(`SELECT * FROM ${tableName} WHERE ${pkField} = ?`, [lastParam]);
              rows = updated;
            }
          }
        }
      }

      return { rows, insertId: results ? results.insertId : null, affectedRows: results ? results.affectedRows : 0 };
    }
  };
}
