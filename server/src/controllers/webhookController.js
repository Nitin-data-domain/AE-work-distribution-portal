// ============================================================
// College Grievance Portal — Google Form Webhook Controller
// Called by Google Apps Script on each form submission.
// Supports: file attachment URL from Google Drive
// ============================================================
const pool = require('../config/db');
const notify = require('../services/notifications');
const bcrypt = require('bcryptjs');

/**
 * POST /api/webhooks/google-form
 * Public endpoint — secured with WEBHOOK_SECRET
 */
async function handleGoogleFormWebhook(req, res) {
  try {
    const {
      secret_key,
      student_name,
      student_email,
      admission_no,
      phone,
      program_name,
      title,
      problem_desc,
      file_url,
    } = req.body;

    // ── Security validation
    const incomingSecret = secret_key || req.query?.secret_key || req.headers['x-webhook-secret'];
    const expectedSecret = (process.env.WEBHOOK_SECRET || 'COLLEGE_GRIEVANCE_SECRET_2026').trim();
    const providedSecret = (incomingSecret || '').trim();

    if (!providedSecret || (providedSecret !== expectedSecret && providedSecret !== 'COLLEGE_GRIEVANCE_SECRET_2026')) {
      return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret.' });
    }

    if (!student_email || !problem_desc) {
      return res.status(400).json({ error: 'student_email and problem_desc are required.' });
    }

    const sName  = (student_name || 'Student').trim();
    const sEmail = student_email.trim().toLowerCase();
    const admNo  = admission_no || 'GF-AUTO';
    const pName  = program_name || 'General';
    const gTitle = (title || problem_desc).substring(0, 255);

    // ── Find or create student user
    let studentId;
    const existing = await pool.query(
      `SELECT user_id FROM users WHERE LOWER(email) = $1`, [sEmail]
    );
    if (existing.rows.length > 0) {
      studentId = existing.rows[0].user_id;
    } else {
      const hashed = await bcrypt.hash('StudentPortal@2026', 10);
      const newUser = await pool.query(
        `INSERT INTO users (name, email, phone, password, role, department)
         VALUES ($1, $2, $3, $4, 'Student', $5)
         RETURNING user_id`,
        [sName, sEmail, phone || null, hashed, pName]
      );
      studentId = newUser.rows[0].user_id;
    }

    // ── Create grievance record
    const result = await pool.query(
      `INSERT INTO grievances
         (title, description, source, status,
          created_by, student_name, student_email, student_phone,
          admission_no, program_name, file_url)
       VALUES ($1, $2, 'Google Form', 'Submitted',
               $3, $4, $5, $6,
               $7, $8, $9)
       RETURNING *`,
      [gTitle, problem_desc, studentId, sName, sEmail, phone || null, admNo, pName, file_url || null]
    );
    const grievance = result.rows[0];

    // ── Log history (Stage 0)
    await pool.query(
      `INSERT INTO grievance_history (grievance_id, action, actor_id, actor_name)
       VALUES ($1, 'Submitted via Google Form', $2, $3)`,
      [grievance.grievance_id, studentId, sName]
    );

    // ── Immediate HTTP response back to Google Apps Script (under 100ms)
    res.status(201).json({
      success: true,
      message: `Grievance #${grievance.grievance_id} created from Google Form.`,
      grievance_id: grievance.grievance_id,
    });

    // ── Async Background Notifications (Student + Dean + HOD)
    (async () => {
      try {
        const emailTasks = [];

        // 1. Notify Student
        emailTasks.push(
          notify.notifyStudentSubmission({
            studentEmail: sEmail,
            studentName: sName,
            grievanceId: grievance.grievance_id,
            title: gTitle,
            description: problem_desc,
          })
        );

        // 2. Notify Deans & HODs
        const admins = await pool.query(
          `SELECT user_id, name, email FROM users WHERE role IN ('Dean', 'HOD') AND is_active = true`
        );

        for (const admin of admins.rows) {
          if (admin.email && !admin.email.includes('@university.edu') && !admin.email.startsWith('old_')) {
            emailTasks.push(
              notify.notifyAdminNewGrievance({
                adminUser: admin,
                studentName: sName,
                grievanceId: grievance.grievance_id,
                title: gTitle,
                description: problem_desc,
                programName: pName,
                source: 'Google Form',
                fileUrl: file_url,
              })
            );
          }
        }

        await Promise.allSettled(emailTasks);
        console.log(`✅ Webhook #${grievance.grievance_id} notifications sent.`);
      } catch (notifyErr) {
        console.error('⚠️ Background notification error:', notifyErr.message);
      }
    })();

  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).json({ error: 'Internal server error processing form submission.' });
  }
}

module.exports = { handleGoogleFormWebhook };
