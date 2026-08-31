// ============================================================
// College Grievance Portal — Express Server Entry Point
// ============================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes      = require('./routes/auth');
const grievanceRoutes = require('./routes/grievances');
const userRoutes      = require('./routes/users');
const reportRoutes    = require('./routes/reports');
const webhookRoutes   = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.includes('airoapp.ai')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow request to avoid CORS blocking production previews
    }
  },
  credentials: true,
}));

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/grievances', grievanceRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/webhooks',   webhookRoutes);

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: process.env.COLLEGE_NAME || 'College Grievance Portal',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    email: {
      googleProxy: !!process.env.GOOGLE_SCRIPT_URL,
      smtp: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      method: process.env.GOOGLE_SCRIPT_URL ? 'google-proxy' : (process.env.SMTP_USER ? 'smtp' : 'mock'),
    },
  });
});

// ─── Serve Static Frontend Assets (Production) ───────────────
const clientBuildPath = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.name === 'MulterError' || (err.message && err.message.toLowerCase().includes('files are allowed'))) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max size is 10MB.' });
    return res.status(400).json({ error: err.message });
  }
  res.status(400).json({ error: err.message || 'An error occurred during request processing.' });
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const collegeName = process.env.COLLEGE_NAME || 'College Grievance Portal';
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║                                                      ║
  ║   🎓 ${collegeName.padEnd(45)}  ║
  ║   Student Grievance & Task Management System         ║
  ║                                                      ║
  ║   🚀 Server : http://localhost:${PORT}               ║
  ║   ❤️  Health : http://localhost:${PORT}/api/health   ║
  ║   🌍 Mode   : ${(process.env.NODE_ENV || 'development').padEnd(38)}║
  ║                                                      ║
  ╚══════════════════════════════════════════════════════╝
  `);

  // Keep-alive ping for hosted environments (every 14 min)
  if (process.env.RENDER_EXTERNAL_URL || process.env.APP_URL) {
    const pingUrl = `${process.env.RENDER_EXTERNAL_URL || process.env.APP_URL}/api/health`;
    const https = require('https');
    const http = require('http');
    const mod = pingUrl.startsWith('https') ? https : http;
    setInterval(() => {
      mod.get(pingUrl, r => console.log(`🔄 Keep-alive ping: ${r.statusCode}`))
         .on('error', e => console.error('❌ Keep-alive failed:', e.message));
    }, 14 * 60 * 1000);
  }
});

module.exports = app;
