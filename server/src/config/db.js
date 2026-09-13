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

  const mysqlUri = (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql'))
    ? process.env.DATABASE_URL
    : process.env.MYSQL_URL;

  const mysqlConfig = mysqlUri
    ? {
        uri: mysqlUri,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      }
    : {
        host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
        user: process.env.DB_USER || process.env.MYSQL_USER,
        password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
        database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
        port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      };

  const mysqlPool = mysql.createPool(mysqlConfig);

  // Auto-initialize schema & seed users on GoDaddy MySQL
  async function autoInitMySQL(pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE,
          phone VARCHAR(20),
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'Student',
          department VARCHAR(100),
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          otp VARCHAR(10),
          otp_expires DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS grievances (
          grievance_id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          source VARCHAR(50) NOT NULL DEFAULT 'Portal',
          status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
          created_by INT,
          student_name VARCHAR(100),
          student_email VARCHAR(100),
          student_phone VARCHAR(20),
          admission_no VARCHAR(50),
          program_name VARCHAR(100),
          assigned_dean INT,
          assigned_hod INT,
          assigned_to INT,
          prev_faculty INT,
          remark_student TEXT,
          remark_internal TEXT,
          file_url VARCHAR(500),
          faculty_file_url VARCHAR(500),
          internal_file_url VARCHAR(500),
          resolved_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS grievance_history (
          history_id INT AUTO_INCREMENT PRIMARY KEY,
          grievance_id INT NOT NULL,
          action VARCHAR(150) NOT NULL,
          actor_id INT,
          actor_name VARCHAR(100),
          remark TEXT,
          changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
      if (rows && rows[0] && rows[0].count === 0) {
        console.log('🌱 Seeding initial administrative accounts in GoDaddy MySQL...');
        await pool.query(`
          INSERT IGNORE INTO users (name, email, phone, password, role, department)
          VALUES
            ('Capt. Deepak Dhalla', 'md@aharadaedu.in', '+919800000001', '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2', 'Dean', 'Administration'),
            ('Mr. Deepak Dhalla Sir', 'nitingirdhar521@gmail.com', '+919800000002', '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2', 'Dean', 'Administration'),
            ('Ms. Somya Pal', 'somya@aharadaedu.in', '+919800000003', '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2', 'HOD', 'Computer Science'),
            ('Mr. Nitin Girdhar', 'nitin@aharadaedu.in', '+919800000004', '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2', 'Faculty', 'Computer Science'),
            ('Rahul Sharma', 'girdharnitin4@gmail.com', '+919800000005', '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2', 'Student', 'BCA')
        `);
        console.log('✅ Seed users created.');
      }
      try {
        await pool.query('ALTER TABLE users ADD COLUMN can_manage_staff TINYINT(1) NOT NULL DEFAULT 0');
      } catch (colErr) {}
    } catch (err) {
      console.warn('⚠️ MySQL auto-init note:', err.message);
    }
  }

  autoInitMySQL(mysqlPool);

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
      if ('can_manage_staff' in normalized) {
        normalized.can_manage_staff = !!normalized.can_manage_staff;
      } else {
        normalized.can_manage_staff = (normalized.role === 'Dean');
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
