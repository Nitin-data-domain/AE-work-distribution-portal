// ============================================================
// College Grievance Portal — Auth Controller
// Login, Register (OTP), Forgot Password, Reset Password
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendEmail } = require('../services/notifications');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// In-memory OTP store for registration
const registrationStore = new Map();

// ─── POST /api/auth/send-otp ─────────────────────────────────
async function sendRegistrationOTP(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const otp = generateOTP();
    registrationStore.set(email, { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    await sendEmail(
      email,
      'OTP for Registration — Grievance Portal',
      `<p>Your OTP is: <strong style="font-size:24px;color:#2563EB;">${otp}</strong><br>Valid for 10 minutes.</p>`,
      `Your registration OTP is: ${otp}. Valid for 10 minutes.`
    );
    res.json({ message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/auth/register ─────────────────────────────────
async function register(req, res) {
  try {
    const { name, email, phone, password, program_name, otp } = req.body;
    if (!name || !email || !password || !otp) {
      return res.status(400).json({ error: 'Name, email, password, and OTP are required.' });
    }

    const entry = registrationStore.get(email);
    if (!entry) return res.status(400).json({ error: 'No OTP found for this email. Please request OTP first.' });
    if (entry.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });
    if (new Date() > entry.expiresAt) {
      registrationStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role, department)
       VALUES ($1, $2, $3, $4, 'Student', $5)
       RETURNING user_id, name, email, role, department, is_active`,
      [name, email, phone || null, hashed, program_name || null]
    );
    const user = result.rows[0];
    registrationStore.delete(email);

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.status(201).json({ message: 'Registration successful.', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const result = await pool.query(
      'SELECT user_id, name, email, phone, password, role, department, is_active FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password.' });

    const user = result.rows[0];
    if (!user.is_active) return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administration.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    delete user.password;
    res.json({ message: 'Login successful.', token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────
async function getMe(req, res) {
  try {
    const result = await pool.query(
      'SELECT user_id, name, email, phone, role, department, is_active FROM users WHERE user_id = $1',
      [req.user.user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/auth/forgot-password ──────────────────────────
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const result = await pool.query('SELECT user_id, name FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No account found with this email.' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await pool.query('UPDATE users SET otp = $1, otp_expires = $2 WHERE LOWER(email) = LOWER($3)', [otp, expiresAt, email]);

    // Try to send email — don't fail the request if email delivery fails
    try {
      await sendEmail(
        email,
        'Password Reset OTP — Aharada Education',
        `<p>Your password reset OTP is: <strong style="font-size:24px;color:#2563EB;">${otp}</strong><br>Valid for 10 minutes. If you did not request this, please ignore.</p>`,
        `Your password reset OTP is: ${otp}. Valid for 10 minutes.`
      );
      console.log(`✅ OTP email sent to ${email}`);
    } catch (emailErr) {
      console.error(`⚠️ OTP email delivery failed for ${email}:`, emailErr.message);
      // OTP is saved in DB — user can still verify
    }

    res.json({ message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: `Failed: ${err.message}` });
  }
}

// ─── POST /api/auth/verify-otp ───────────────────────────────
async function verifyOTP(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const result = await pool.query('SELECT otp, otp_expires FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const user = result.rows[0];
    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });
    if (new Date() > new Date(user.otp_expires)) return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });

    res.json({ message: 'OTP verified.', verified: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/auth/reset-password ───────────────────────────
async function resetPassword(req, res) {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }

    const result = await pool.query('SELECT otp, otp_expires FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const user = result.rows[0];
    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });
    if (new Date() > new Date(user.otp_expires)) return res.status(400).json({ error: 'OTP has expired.' });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = $1, otp = NULL, otp_expires = NULL WHERE email = $2', [hashed, email]);
    res.json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── PUT /api/auth/change-password ───────────────────────────
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    const result = await pool.query('SELECT password FROM users WHERE user_id = $1', [req.user.user_id]);
    const user = result.rows[0];
    const valid = await bcrypt.compare(current_password, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [hashed, req.user.user_id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { sendRegistrationOTP, register, login, getMe, forgotPassword, verifyOTP, resetPassword, changePassword };
