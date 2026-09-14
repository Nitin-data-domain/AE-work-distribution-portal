// ============================================================
// College Grievance Portal — JWT Auth Middleware
// ============================================================
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'college_grievance_portal_secret_2026';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

const pool = require('../config/db');

/**
 * Role-based access guard
 * Usage: requireRole('Dean', 'HOD')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
    }
    next();
  };
}

/**
 * Staff management access guard
 * Allows Dean, or any faculty/HOD granted can_manage_staff permission
 */
async function requireStaffManager(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Access denied. Please login.' });
  if (req.user.role === 'Dean') return next();

  try {
    const userRes = await pool.query('SELECT can_manage_staff FROM users WHERE user_id = $1', [req.user.user_id]);
    if (userRes.rows.length > 0 && userRes.rows[0].can_manage_staff) {
      return next();
    }
  } catch (err) {
    console.error('Staff manager permission check error:', err);
  }
  return res.status(403).json({ error: 'Forbidden: You do not have permission to manage staff accounts.' });
}

module.exports = { authMiddleware, requireRole, requireStaffManager };
