// ============================================================
// College Grievance Portal — User Controller
// Dean: full CRUD for faculty/HOD accounts
// HOD: view faculty list, toggle active
// ============================================================
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// ─── GET /api/users/faculty — All active faculty (for dropdowns)
async function getFaculty(req, res) {
  try {
    const result = await pool.query(
      `SELECT user_id, name, email, phone, department, is_active
       FROM users WHERE role = 'Faculty' ORDER BY name ASC`
    );
    res.json({ faculty: result.rows });
  } catch (err) {
    console.error('Get faculty error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/users/hods — All HODs (for Dean assignment dropdown)
async function getHODs(req, res) {
  try {
    const result = await pool.query(
      `SELECT user_id, name, email, phone, department, is_active
       FROM users WHERE role = 'HOD' ORDER BY name ASC`
    );
    res.json({ hods: result.rows });
  } catch (err) {
    console.error('Get HODs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/users — All users (Dean/HOD only)
async function getAllUsers(req, res) {
  try {
    const { role } = req.query;
    let query = `SELECT user_id, name, email, phone, role, department, is_active, created_at FROM users`;
    const params = [];
    if (role) { query += ` WHERE role = $1`; params.push(role); }
    query += ` ORDER BY role ASC, name ASC`;
    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/users — Dean creates a new Faculty/HOD account
async function createUser(req, res) {
  try {
    const { name, email, phone, password, role, department } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }
    const allowed = ['Faculty', 'HOD'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ error: 'Role must be Faculty or HOD.' });
    }

    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already in use.' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, name, email, phone, role, department, is_active`,
      [name, email, phone || null, hashed, role, department || null]
    );
    res.status(201).json({ message: `${role} account created.`, user: result.rows[0] });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── PUT /api/users/:id — Dean updates user credentials
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, password, department } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (name)       { updates.push(`name = $${idx++}`);       params.push(name); }
    if (email)      { updates.push(`email = $${idx++}`);      params.push(email); }
    if (phone)      { updates.push(`phone = $${idx++}`);      params.push(phone); }
    if (department) { updates.push(`department = $${idx++}`); params.push(department); }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updates.push(`password = $${idx++}`);
      params.push(hashed);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields provided.' });

    params.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx}
       RETURNING user_id, name, email, phone, role, department, is_active`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User updated successfully.', user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── PUT /api/users/:id/toggle — Toggle is_active for faculty/HOD
async function toggleActive(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users SET is_active = NOT is_active WHERE user_id = $1
       RETURNING user_id, name, email, is_active, role`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = result.rows[0];
    res.json({ message: `${user.name} has been ${user.is_active ? 'activated' : 'deactivated'}.`, user });
  } catch (err) {
    console.error('Toggle active error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── PUT /api/users/profile — Update own profile
async function updateProfile(req, res) {
  try {
    const { name, phone, department } = req.body;
    const result = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         department = COALESCE($3, department)
       WHERE user_id = $4
       RETURNING user_id, name, email, phone, role, department`,
      [name || null, phone || null, department || null, req.user.user_id]
    );
    res.json({ message: 'Profile updated.', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getFaculty, getHODs, getAllUsers, createUser, updateUser, toggleActive, updateProfile };
