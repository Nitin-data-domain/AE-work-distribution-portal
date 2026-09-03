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

  /**
   * Normalize MySQL rows: convert TINYINT is_active (0/1) to boolean true/false
   * and ensure COUNT/SUM results are consistent
   */
  function normalizeRows(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(row => {
      const normalized = { ...row };
      if ('is_active' in normalized) {
        normalized.is_active = !!normalized.is_active;
      }
      return normalized;
    });
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

      // 3. Handle Postgres 'NOT is_active' → MySQL '1 - is_active' for TINYINT toggle
      formattedSql = formattedSql.replace(
        /SET\s+is_active\s*=\s*NOT\s+is_active/gi,
        'SET is_active = 1 - is_active'
      );

      // 4. Handle PostgreSQL EXTRACT → MySQL equivalents
      formattedSql = formattedSql.replace(/EXTRACT\s*\(\s*MONTH\s+FROM\s+/gi, 'MONTH(');
      formattedSql = formattedSql.replace(/EXTRACT\s*\(\s*YEAR\s+FROM\s+/gi, 'YEAR(');
      // Remove ::int type casts (Postgres-specific)
      formattedSql = formattedSql.replace(/::int/gi, '');

      // 5. Cast LIMIT and OFFSET params to integers (mysql2 execute doesn't support ? for LIMIT/OFFSET)
      const queryParams = [...params];
      const limitMatch = formattedSql.match(/LIMIT\s+\?\s+OFFSET\s+\?/i);
      if (limitMatch && queryParams.length >= 2) {
        const offsetVal = parseInt(queryParams.pop());
        const limitVal = parseInt(queryParams.pop());
        formattedSql = formattedSql.replace(
          /LIMIT\s+\?\s+OFFSET\s+\?/i,
          `LIMIT ${limitVal} OFFSET ${offsetVal}`
        );
      }

      // Use query() instead of execute() for broader compatibility
      const [results] = await mysqlPool.query(formattedSql, queryParams);
      
      let rows = Array.isArray(results) ? results : [];

      if (!Array.isArray(results) && returningMatch) {
        // If it was an INSERT with RETURNING
        if (results.insertId) {
          const tableMatch = sqlText.match(/INSERT\s+INTO\s+([^\s(]+)/i);
          if (tableMatch) {
            const tableName = tableMatch[1].toLowerCase();
            const pkField = tableName === 'users' ? 'user_id' : (tableName === 'grievances' ? 'grievance_id' : 'history_id');
            const [inserted] = await mysqlPool.query(`SELECT * FROM ${tableName} WHERE ${pkField} = ?`, [results.insertId]);
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
              const [updated] = await mysqlPool.query(`SELECT * FROM ${tableName} WHERE ${pkField} = ?`, [lastParam]);
              rows = updated;
            }
          }
        }
      }

      // Normalize is_active and count fields
      rows = normalizeRows(rows);

      return { rows, insertId: results ? results.insertId : null, affectedRows: results ? results.affectedRows : 0 };
    }
  };
}
