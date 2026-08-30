// ============================================================
// College Grievance Portal — Grievance Controller
// Full lifecycle: Submit → Assign → Remark → Resolve
// ============================================================
const pool = require('../config/db');
const notify = require('../services/notifications');

// ─── Helper: get student name/email from grievance ───────────
function getStudentInfo(grievance) {
  return {
    name: grievance.student_name || 'Student',
    email: grievance.student_email || null,
  };
}

// ─── Helper: log to grievance_history ────────────────────────
async function logHistory(grievanceId, action, actorId, actorName, remark = null) {
  await pool.query(
    `INSERT INTO grievance_history (grievance_id, action, actor_id, actor_name, remark)
     VALUES ($1, $2, $3, $4, $5)`,
    [grievanceId, action, actorId, actorName, remark]
  );
}

// ─── Helper: get all Deans & HODs ────────────────────────────
async function getAdmins() {
  const result = await pool.query(
    `SELECT user_id, name, email FROM users WHERE role IN ('Dean', 'HOD') AND is_active = true`
  );
  return result.rows;
}

// ============================================================
// POST /api/grievances — Student submits grievance
// ============================================================
async function createGrievance(req, res) {
  try {
    const { title, description, admission_no, program_name } = req.body;
    const student = req.user;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Get student details from DB
    const studentRow = await pool.query(
      'SELECT name, email, phone, department FROM users WHERE user_id = $1',
      [student.user_id]
    );
    const studentData = studentRow.rows[0] || {};

    const result = await pool.query(
      `INSERT INTO grievances
         (title, description, source, status, created_by,
          student_name, student_email, student_phone, admission_no, program_name, file_url)
       VALUES ($1, $2, 'Portal', 'Submitted', $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title, description, student.user_id,
        studentData.name || student.name,
        studentData.email || student.email,
        studentData.phone || null,
        admission_no || null,
        program_name || studentData.department || null,
        fileUrl,
      ]
    );

    const grievance = result.rows[0];

    // Log history
    await logHistory(grievance.grievance_id, 'Submitted via Portal', student.user_id, student.name);

    // Notify student — Stage 0
    await notify.notifyStudentSubmission({
      studentEmail: studentData.email || student.email,
      studentName: studentData.name || student.name,
      grievanceId: grievance.grievance_id,
      title,
      description,
    });

    // Notify all Deans & HODs
    const admins = await getAdmins();
    for (const admin of admins) {
      await notify.notifyAdminNewGrievance({
        adminUser: admin,
        studentName: studentData.name || student.name,
        grievanceId: grievance.grievance_id,
        title,
        description,
        programName: program_name || studentData.department,
        source: 'Portal',
      });
    }

    res.status(201).json({ message: 'Grievance submitted successfully.', grievance });
  } catch (err) {
    console.error('Create grievance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// GET /api/grievances — List grievances (role-filtered)
// ============================================================
async function getGrievances(req, res) {
  try {
    const { user_id, role } = req.user;
    const { status, source, month, year, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let idx = 1;

    if (role === 'Student') {
      where.push(`g.created_by = $${idx++}`);
      params.push(user_id);
    } else if (role === 'Faculty') {
      where.push(`g.assigned_to = $${idx++}`);
      params.push(user_id);
    }
    // HOD and Dean see ALL

    if (status) { where.push(`g.status = $${idx++}`); params.push(status); }
    if (source) { where.push(`g.source = $${idx++}`); params.push(source); }
    if (month) { where.push(`MONTH(g.created_at) = $${idx++}`); params.push(parseInt(month)); }
    if (year) { where.push(`YEAR(g.created_at) = $${idx++}`); params.push(parseInt(year)); }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const query = `
      SELECT
        g.*,
        u_creator.name  AS creator_name,
        u_faculty.name  AS faculty_name,
        u_faculty.email AS faculty_email,
        u_prev.name     AS prev_faculty_name,
        u_hod.name      AS hod_name,
        u_dean.name     AS dean_name
      FROM grievances g
      LEFT JOIN users u_creator ON g.created_by    = u_creator.user_id
      LEFT JOIN users u_faculty ON g.assigned_to   = u_faculty.user_id
      LEFT JOIN users u_prev    ON g.prev_faculty   = u_prev.user_id
      LEFT JOIN users u_hod     ON g.assigned_hod  = u_hod.user_id
      LEFT JOIN users u_dean    ON g.assigned_dean = u_dean.user_id
      ${whereClause}
      ORDER BY g.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}`;

    params.push(parseInt(limit), offset);
    const result = await pool.query(query, params);

    // Count query
    const countParams = params.slice(0, params.length - 2);
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM grievances g ${whereClause}`,
      countParams
    );
    // MySQL returns count as 'total' (aliased), Postgres as 'count'
    const total = parseInt(countResult.rows[0].total || countResult.rows[0].count || 0);

    res.json({ grievances: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Get grievances error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// GET /api/grievances/:id — Single grievance + history
// ============================================================
async function getGrievanceById(req, res) {
  try {
    const { id } = req.params;
    const { user_id, role } = req.user;

    const result = await pool.query(`
      SELECT g.*,
        u_creator.name  AS creator_name,
        u_faculty.name  AS faculty_name,
        u_faculty.email AS faculty_email,
        u_faculty.phone AS faculty_phone,
        u_prev.name     AS prev_faculty_name,
        u_hod.name      AS hod_name,
        u_dean.name     AS dean_name
      FROM grievances g
      LEFT JOIN users u_creator ON g.created_by    = u_creator.user_id
      LEFT JOIN users u_faculty ON g.assigned_to   = u_faculty.user_id
      LEFT JOIN users u_prev    ON g.prev_faculty   = u_prev.user_id
      LEFT JOIN users u_hod     ON g.assigned_hod  = u_hod.user_id
      LEFT JOIN users u_dean    ON g.assigned_dean = u_dean.user_id
      WHERE g.grievance_id = $1`, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Grievance not found.' });

    const grievance = result.rows[0];

    // Access control for students and faculty
    if (role === 'Student' && grievance.created_by !== user_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (role === 'Faculty' && grievance.assigned_to !== user_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Get history
    const history = await pool.query(
      `SELECT * FROM grievance_history WHERE grievance_id = $1 ORDER BY changed_at ASC`,
      [id]
    );

    res.json({ grievance, history: history.rows });
  } catch (err) {
    console.error('Get grievance by id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// PUT /api/grievances/:id/assign-hod — Dean assigns to HOD
// ============================================================
async function assignToHOD(req, res) {
  try {
    const { id } = req.params;
    const { hod_id } = req.body;
    if (!hod_id) return res.status(400).json({ error: 'HOD ID is required.' });

    const hodResult = await pool.query(
      `SELECT user_id, name, email FROM users WHERE user_id = $1 AND role = 'HOD' AND is_active = true`,
      [hod_id]
    );
    if (hodResult.rows.length === 0) return res.status(404).json({ error: 'HOD not found.' });
    const hod = hodResult.rows[0];

    const result = await pool.query(
      `UPDATE grievances SET assigned_hod = $1, assigned_dean = $2, updated_at = NOW()
       WHERE grievance_id = $3 RETURNING *`,
      [hod_id, req.user.user_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Grievance not found.' });
    const grievance = result.rows[0];

    await logHistory(id, `Assigned to HOD: ${hod.name}`, req.user.user_id, req.user.name);

    // Notify HOD
    await notify.notifyFacultyAssigned({
      facultyUser: hod,
      grievanceId: id,
      title: grievance.title,
      description: grievance.description,
      assignedByName: req.user.name,
      studentName: grievance.student_name,
      programName: grievance.program_name,
    });

    res.json({ message: `Grievance assigned to HOD ${hod.name}.`, grievance });
  } catch (err) {
    console.error('Assign to HOD error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// PUT /api/grievances/:id/assign-faculty — HOD/Dean assigns to Faculty
// ============================================================
async function assignToFaculty(req, res) {
  try {
    const { id } = req.params;
    const { faculty_id } = req.body;
    if (!faculty_id) return res.status(400).json({ error: 'Faculty ID is required.' });

    const facultyResult = await pool.query(
      `SELECT user_id, name, email, phone FROM users WHERE user_id = $1 AND role = 'Faculty' AND is_active = true`,
      [faculty_id]
    );
    if (facultyResult.rows.length === 0) return res.status(404).json({ error: 'Faculty not found or inactive.' });
    const faculty = facultyResult.rows[0];

    const result = await pool.query(
      `UPDATE grievances SET assigned_to = $1, status = 'Assigned', updated_at = NOW()
       WHERE grievance_id = $2 RETURNING *`,
      [faculty_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Grievance not found.' });
    const grievance = result.rows[0];

    await logHistory(id, `Assigned to Faculty: ${faculty.name}`, req.user.user_id, req.user.name);

    const student = getStudentInfo(grievance);

    // Notify faculty
    await notify.notifyFacultyAssigned({
      facultyUser: faculty,
      grievanceId: id,
      title: grievance.title,
      description: grievance.description,
      assignedByName: req.user.name,
      studentName: student.name,
      programName: grievance.program_name,
    });

    // Notify student (if not an internal task)
    if (grievance.source !== 'Internal' && student.email) {
      await notify.notifyStudentAssigned({
        studentEmail: student.email,
        studentName: student.name,
        facultyName: faculty.name,
        grievanceId: id,
        title: grievance.title,
      });
    }

    res.json({ message: `Grievance assigned to Prof. ${faculty.name}.`, grievance });
  } catch (err) {
    console.error('Assign to faculty error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// PUT /api/grievances/:id/reassign — Reassign to different faculty
// ============================================================
async function reassignFaculty(req, res) {
  try {
    const { id } = req.params;
    const { faculty_id, reason } = req.body;
    if (!faculty_id) return res.status(400).json({ error: 'New Faculty ID is required.' });

    const grievanceRow = await pool.query('SELECT * FROM grievances WHERE grievance_id = $1', [id]);
    if (grievanceRow.rows.length === 0) return res.status(404).json({ error: 'Grievance not found.' });
    const grievance = grievanceRow.rows[0];

    const newFacultyResult = await pool.query(
      `SELECT user_id, name, email, phone FROM users WHERE user_id = $1 AND role = 'Faculty' AND is_active = true`,
      [faculty_id]
    );
    if (newFacultyResult.rows.length === 0) return res.status(404).json({ error: 'Faculty not found or inactive.' });
    const newFaculty = newFacultyResult.rows[0];

    if (parseInt(faculty_id) === grievance.assigned_to) {
      return res.status(400).json({ error: 'New faculty must be different from current.' });
    }

    await pool.query(
      `UPDATE grievances SET prev_faculty = assigned_to, assigned_to = $1, status = 'Assigned', updated_at = NOW()
       WHERE grievance_id = $2`,
      [faculty_id, id]
    );

    const historyNote = `Reassigned to Prof. ${newFaculty.name}${reason ? '. Reason: ' + reason : ''}`;
    await logHistory(id, historyNote, req.user.user_id, req.user.name, reason || null);

    const student = getStudentInfo(grievance);

    // Notify new faculty
    await notify.notifyFacultyReassigned({
      newFaculty,
      grievanceId: id,
      title: grievance.title,
      reassignedByName: req.user.name,
      studentName: student.name,
      reason,
    });

    // Notify student
    if (grievance.source !== 'Internal' && student.email) {
      await notify.notifyStudentReassigned({
        studentEmail: student.email,
        studentName: student.name,
        newFacultyName: newFaculty.name,
        grievanceId: id,
        title: grievance.title,
      });
    }

    // Notify Dean & HOD
    const admins = await getAdmins();
    for (const admin of admins) {
      await notify.notifyAdminInternalUpdate({
        adminUser: admin,
        facultyName: req.user.name,
        grievanceId: id,
        title: grievance.title,
        status: 'Reassigned',
        remark: historyNote,
      });
    }

    res.json({ message: `Reassigned to Prof. ${newFaculty.name}.` });
  } catch (err) {
    console.error('Reassign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// PUT /api/grievances/:id/update — Faculty updates status/remarks
// ============================================================
async function updateGrievance(req, res) {
  try {
    const { id } = req.params;
    const { status, remark_student, remark_internal } = req.body;
    const { user_id, role, name } = req.user;

    const grievanceRow = await pool.query('SELECT * FROM grievances WHERE grievance_id = $1', [id]);
    if (grievanceRow.rows.length === 0) return res.status(404).json({ error: 'Grievance not found.' });
    const grievance = grievanceRow.rows[0];

    // Faculty can only update their own assigned task
    if (role === 'Faculty' && grievance.assigned_to !== user_id) {
      return res.status(403).json({ error: 'You are not assigned to this grievance.' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (status) {
      const validStatuses = ['In Progress', 'Resolved', 'Closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
      }
      updates.push(`status = $${idx++}`); params.push(status);
      if (status === 'Resolved') {
        updates.push(`resolved_at = NOW()`);
      }
    }
    if (remark_student !== undefined) { updates.push(`remark_student = $${idx++}`); params.push(remark_student); }
    if (remark_internal !== undefined) { updates.push(`remark_internal = $${idx++}`); params.push(remark_internal); }
    if (req.files) {
      if (req.files['faculty_file'] && req.files['faculty_file'].length > 0) {
        updates.push(`faculty_file_url = $${idx++}`);
        params.push(`/uploads/${req.files['faculty_file'][0].filename}`);
      }
      if (req.files['internal_file'] && req.files['internal_file'].length > 0) {
        updates.push(`internal_file_url = $${idx++}`);
        params.push(`/uploads/${req.files['internal_file'][0].filename}`);
      }
    } else if (req.file) {
      updates.push(`faculty_file_url = $${idx++}`);
      params.push(`/uploads/${req.file.filename}`);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No update data provided.' });

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE grievances SET ${updates.join(', ')} WHERE grievance_id = $${idx} RETURNING *`,
      params
    );
    const updated = result.rows[0];

    // Log history
    const actionDesc = status ? `Status changed to ${status}` : 'Remarks updated';
    await logHistory(id, actionDesc, user_id, name, remark_internal || remark_student || null);

    const student = getStudentInfo(updated);

    // If student-facing remark or student file attachment was updated → email student
    if ((remark_student || updated.faculty_file_url) && updated.source !== 'Internal' && student.email) {
      if (status === 'Resolved') {
        await notify.notifyStudentResolved({
          studentEmail: student.email,
          studentName: student.name,
          facultyName: name,
          grievanceId: id,
          title: updated.title,
          remark: remark_student,
          fileUrl: updated.faculty_file_url,
        });
      } else if (remark_student || req.files?.['faculty_file'] || req.file) {
        await notify.notifyStudentRemark({
          studentEmail: student.email,
          studentName: student.name,
          facultyName: name,
          grievanceId: id,
          title: updated.title,
          remark: remark_student,
          status: status || updated.status,
          fileUrl: updated.faculty_file_url,
        });
      }
    }

    // Notify Dean & HOD on status changes or remarks
    if (status || remark_internal || remark_student) {
      const admins = await getAdmins();
      for (const admin of admins) {
        if (status === 'Resolved') {
          await notify.notifyAdminResolved({
            adminUser: admin,
            facultyName: name,
            grievanceId: id,
            title: updated.title,
            studentName: student.name,
            remark_student,
            remark_internal,
          });
        } else {
          await notify.notifyAdminInternalUpdate({
            adminUser: admin,
            facultyName: name,
            grievanceId: id,
            title: updated.title,
            status,
            remark_student,
            remark_internal,
          });
        }
      }
    }

    res.json({ message: 'Grievance updated successfully.', grievance: updated });
  } catch (err) {
    console.error('Update grievance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// POST /api/grievances/internal — Dean/HOD creates internal task
// ============================================================
async function createInternalTask(req, res) {
  try {
    const { title, description, faculty_id, hod_id } = req.body;
    const { user_id, role, name } = req.user;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }
    if (!faculty_id && !hod_id) {
      return res.status(400).json({ error: 'Assign to at least one faculty or HOD.' });
    }

    let assignedTo = null;
    let assignedHod = null;
    let targetUser = null;

    if (faculty_id) {
      const fResult = await pool.query(
        `SELECT user_id, name, email FROM users WHERE user_id = $1 AND role = 'Faculty' AND is_active = true`,
        [faculty_id]
      );
      if (fResult.rows.length === 0) return res.status(404).json({ error: 'Faculty not found.' });
      targetUser = fResult.rows[0];
      assignedTo = faculty_id;
    } else if (hod_id) {
      const hResult = await pool.query(
        `SELECT user_id, name, email FROM users WHERE user_id = $1 AND role = 'HOD' AND is_active = true`,
        [hod_id]
      );
      if (hResult.rows.length === 0) return res.status(404).json({ error: 'HOD not found.' });
      targetUser = hResult.rows[0];
      assignedHod = hod_id;
    }

    const result = await pool.query(
      `INSERT INTO grievances
         (title, description, source, status, created_by,
          student_name, student_email,
          assigned_to, assigned_hod, assigned_dean)
       VALUES ($1, $2, 'Internal', 'Assigned', $3, $4, NULL, $5, $6, $7)
       RETURNING *`,
      [
        title, description, user_id,
        `Created by ${name}`, // use student_name field to store creator info
        assignedTo,
        assignedHod,
        role === 'Dean' ? user_id : null,
      ]
    );
    const grievance = result.rows[0];

    await logHistory(grievance.grievance_id, `Internal task created by ${name}`, user_id, name);

    // Notify assigned person
    await notify.notifyFacultyInternalTask({
      facultyUser: targetUser,
      grievanceId: grievance.grievance_id,
      title,
      description,
      assignedByName: name,
    });

    // If created by Dean and assigned to faculty, also notify HODs
    if (role === 'Dean' && assignedTo) {
      const hods = await pool.query(`SELECT user_id, name, email FROM users WHERE role = 'HOD' AND is_active = true`);
      for (const hod of hods.rows) {
        await notify.notifyHODInternalTaskCreated({
          hodUser: hod,
          facultyName: targetUser.name,
          grievanceId: grievance.grievance_id,
          title,
          description,
          assignedByName: name,
        });
      }
    }

    res.status(201).json({ message: 'Internal task created.', grievance });
  } catch (err) {
    console.error('Create internal task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// GET /api/grievances/:id/history — Audit trail
// ============================================================
async function getHistory(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM grievance_history WHERE grievance_id = $1 ORDER BY changed_at ASC`,
      [id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createGrievance,
  getGrievances,
  getGrievanceById,
  assignToHOD,
  assignToFaculty,
  reassignFaculty,
  updateGrievance,
  createInternalTask,
  getHistory,
};
