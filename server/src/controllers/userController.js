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

// ─── GET /api/users — All users (Dean/Staff Managers)
async function getAllUsers(req, res) {
  try {
    const { role } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.email, u.phone, u.role, u.department, u.is_active, 
             COALESCE(u.can_manage_staff, 0) AS can_manage_staff, u.created_at,
             (SELECT COUNT(*) FROM grievances g 
              WHERE (g.assigned_to = u.user_id OR g.assigned_hod = u.user_id OR g.assigned_dean = u.user_id)
                AND g.status NOT IN ('Resolved', 'Closed')) AS pending_tasks_count
      FROM users u
    `;
    const params = [];
    if (role) {
      query += ` WHERE u.role = $1`;
      params.push(role);
    }
    query += ` ORDER BY u.role ASC, u.name ASC`;
    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/users — Create new Faculty/HOD account with optional staff management power
async function createUser(req, res) {
  try {
    const { name, email, phone, password, role, department, can_manage_staff } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }
    const allowed = ['Faculty', 'HOD', 'Dean'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ error: 'Role must be Faculty, HOD, or Dean.' });
    }

    const existing = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already in use.' });

    const hashed = await bcrypt.hash(password, 10);
    const managePower = (role === 'Dean' || can_manage_staff) ? 1 : 0;

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role, department, can_manage_staff)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, name, email, phone, role, department, is_active, can_manage_staff`,
      [name.trim(), email.trim(), phone ? phone.trim() : null, hashed, role, department ? department.trim() : null, managePower]
    );
    res.status(201).json({ message: `${role} account created.`, user: result.rows[0] });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── PUT /api/users/:id — Update user credentials and permissions
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, password, department, role, can_manage_staff } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (name) {
      updates.push(`name = $${idx++}`);
      params.push(name.trim());
    }
    if (email) {
      const existing = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND user_id != $2', [email.trim(), id]);
      if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already in use.' });
      updates.push(`email = $${idx++}`);
      params.push(email.trim());
    }
    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      params.push(phone ? phone.trim() : null);
    }
    if (department !== undefined) {
      updates.push(`department = $${idx++}`);
      params.push(department ? department.trim() : null);
    }
    if (role) {
      const allowed = ['Faculty', 'HOD', 'Dean'];
      if (!allowed.includes(role)) {
        return res.status(400).json({ error: 'Role must be Faculty, HOD, or Dean.' });
      }
      updates.push(`role = $${idx++}`);
      params.push(role);
    }
    if (can_manage_staff !== undefined) {
      updates.push(`can_manage_staff = $${idx++}`);
      params.push(can_manage_staff ? 1 : 0);
    }
    if (password && password.trim()) {
      const hashed = await bcrypt.hash(password.trim(), 10);
      updates.push(`password = $${idx++}`);
      params.push(hashed);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields provided.' });

    params.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx}
       RETURNING user_id, name, email, phone, role, department, is_active, can_manage_staff`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User updated successfully.', user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── DELETE /api/users/:id — Delete user (blocks if pending tasks exist)
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (parseInt(id) === parseInt(req.user.user_id)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const userRes = await pool.query('SELECT user_id, name, role FROM users WHERE user_id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const targetUser = userRes.rows[0];

    // Check if this staff member has any active/pending grievances assigned
    const pending = await pool.query(
      `SELECT grievance_id, title, status FROM grievances
       WHERE (assigned_to = $1 OR assigned_hod = $1 OR assigned_dean = $1)
         AND status NOT IN ('Resolved', 'Closed')`,
      [id]
    );

    if (pending.rows.length > 0) {
      return res.status(400).json({
        error: `Cannot delete ${targetUser.name}: They have ${pending.rows.length} pending task(s) assigned. Please reassign these tasks to another staff member first.`,
        pendingCount: pending.rows.length,
        pendingTasks: pending.rows,
        userId: targetUser.user_id,
        userName: targetUser.name,
      });
    }

    // Safely clear references before deleting
    await pool.query('UPDATE grievances SET created_by = NULL WHERE created_by = $1', [id]);
    await pool.query('UPDATE grievances SET assigned_to = NULL WHERE assigned_to = $1', [id]);
    await pool.query('UPDATE grievances SET assigned_hod = NULL WHERE assigned_hod = $1', [id]);
    await pool.query('UPDATE grievances SET assigned_dean = NULL WHERE assigned_dean = $1', [id]);
    await pool.query('UPDATE grievances SET prev_faculty = NULL WHERE prev_faculty = $1', [id]);
    await pool.query('UPDATE grievance_history SET actor_id = NULL WHERE actor_id = $1', [id]);

    await pool.query('DELETE FROM users WHERE user_id = $1', [id]);

    res.json({ success: true, message: `Account for ${targetUser.name} has been deleted.` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error while deleting user.' });
  }
}

// ─── POST /api/users/:id/reassign-and-delete — Reassign all pending tasks to another staff member, then delete
async function reassignAndDeleteUser(req, res) {
  try {
    const { id } = req.params;
    const { reassignToUserId } = req.body;

    if (!reassignToUserId) {
      return res.status(400).json({ error: 'Replacement staff member (reassignToUserId) is required.' });
    }
    if (parseInt(id) === parseInt(req.user.user_id)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    if (parseInt(id) === parseInt(reassignToUserId)) {
      return res.status(400).json({ error: 'Cannot reassign tasks to the user being deleted.' });
    }

    const targetNew = await pool.query(
      'SELECT user_id, name, role FROM users WHERE user_id = $1 AND is_active = true',
      [reassignToUserId]
    );
    if (targetNew.rows.length === 0) {
      return res.status(400).json({ error: 'Selected replacement staff member not found or inactive.' });
    }
    const newStaff = targetNew.rows[0];

    const oldRes = await pool.query('SELECT user_id, name, role FROM users WHERE user_id = $1', [id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const oldStaff = oldRes.rows[0];

    // Find and reassign pending grievances
    const pending = await pool.query(
      `SELECT grievance_id, title FROM grievances
       WHERE (assigned_to = $1 OR assigned_hod = $1 OR assigned_dean = $1)
         AND status NOT IN ('Resolved', 'Closed')`,
      [id]
    );

    for (const g of pending.rows) {
      await pool.query(
        `UPDATE grievances SET 
           assigned_to = CASE WHEN assigned_to = $1 THEN $2 ELSE assigned_to END,
           assigned_hod = CASE WHEN assigned_hod = $1 THEN $2 ELSE assigned_hod END,
           assigned_dean = CASE WHEN assigned_dean = $1 THEN $2 ELSE assigned_dean END
         WHERE grievance_id = $3`,
        [id, reassignToUserId, g.grievance_id]
      );

      await pool.query(
        `INSERT INTO grievance_history (grievance_id, action, actor_id, actor_name, remark)
         VALUES ($1, 'Reassigned on Account Deletion', $2, $3, $4)`,
        [g.grievance_id, req.user.user_id, req.user.name, `Reassigned from ${oldStaff.name} to ${newStaff.name} due to account deletion.`]
      );
    }

    // Safely clear remaining references
    await pool.query('UPDATE grievances SET created_by = NULL WHERE created_by = $1', [id]);
    await pool.query('UPDATE grievances SET assigned_to = NULL WHERE assigned_to = $1', [id]);
    await pool.query('UPDATE grievances SET assigned_hod = NULL WHERE assigned_hod = $1', [id]);
    await pool.query('UPDATE grievances SET assigned_dean = NULL WHERE assigned_dean = $1', [id]);
    await pool.query('UPDATE grievances SET prev_faculty = NULL WHERE prev_faculty = $1', [id]);
    await pool.query('UPDATE grievance_history SET actor_id = NULL WHERE actor_id = $1', [id]);

    await pool.query('DELETE FROM users WHERE user_id = $1', [id]);

    res.json({
      success: true,
      message: `${pending.rows.length} pending task(s) transferred to ${newStaff.name}, and ${oldStaff.name}'s account was deleted.`
    });
  } catch (err) {
    console.error('Reassign and delete user error:', err);
    res.status(500).json({ error: 'Internal server error during reassign and delete.' });
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

module.exports = {
  getFaculty,
  getHODs,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  reassignAndDeleteUser,
  toggleActive,
  updateProfile
};
