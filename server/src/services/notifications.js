// ============================================================
// Aharada Education — Email Notification Service
// Supports: Google Apps Script Proxy | Gmail SMTP | Mock Mode
// ============================================================
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');

// ─── Google Apps Script GET with manual redirect following ───
// Google Apps Script Web Apps redirect to googleusercontent.com
// which ONLY accepts GET requests (POST returns 405). 
// We pass email data as URL query parameters.
function httpsGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const urlObj = new URL(url);
    const httpModule = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.protocol === 'https:' ? 443 : 80,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'AharadaPortal/1.0' },
    };

    const req = httpModule.request(options, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const location = res.headers.location;
        if (!location) return reject(new Error('Redirect with no Location header'));
        res.resume();
        return httpsGet(location, maxRedirects - 1).then(resolve).catch(reject);
      }

      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('Request timeout')); });
    req.end();
  });
}

// ─── Name Formatter Helper ──────────────────────────────────
/**
 * Strips accidental duplicate prefixes like "Prof. Prof.", "Prof. Mr.", "Prof. Ms."
 */
function cleanName(name) {
  if (!name) return '';
  let str = name.trim();
  str = str.replace(/^(Prof\.\s*)+/i, 'Prof. ');
  str = str.replace(/^Prof\.\s*(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, 'Prof. ');
  str = str.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '$1 ');
  return str;
}

function formatFacultyName(name) {
  if (!name) return 'Faculty Member';
  const cleaned = cleanName(name);
  if (/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)/i.test(cleaned)) {
    return cleaned;
  }
  return `Prof. ${cleaned}`;
}

function formatStudentName(name) {
  if (!name) return 'Student';
  return cleanName(name);
}

// ─── Core Email Sender ──────────────────────────────────────
async function sendEmail(to, subject, htmlBody, textBody) {
  if (!to) return console.warn('⚠️  No recipient email provided.');

  const companyName = process.env.COLLEGE_NAME || 'Aharada Education';

  // 1. Google Apps Script Proxy (REQUIRED for GoDaddy — all SMTP ports blocked)
  //    Uses httpsGet() with query params + manual redirect following.
  //    Google's redirected URL only accepts GET (POST returns 405).
  if (process.env.GOOGLE_SCRIPT_URL) {
    try {
      const scriptUrlStr = process.env.GOOGLE_SCRIPT_URL.trim();
      const plainText = textBody || htmlBody.replace(/<[^>]+>/g, '');

      // Build URL with query parameters
      const url = new URL(scriptUrlStr);
      url.searchParams.set('to', to);
      url.searchParams.set('subject', subject);
      // Send plain text body (HTML exceeds URL length limits)
      url.searchParams.set('body', plainText.substring(0, 1500));

      console.log(`📤 Sending via Google Apps Script Proxy → ${to}`);
      const response = await httpsGet(url.toString());

      let result;
      try { result = JSON.parse(response.body); } catch { result = { success: response.statusCode === 200 }; }

      if (result.success || response.statusCode === 200) {
        console.log(`✅ Email sent via Google Apps Script Proxy → ${to}`);
        return { status: 'sent', method: 'google-proxy' };
      } else {
        throw new Error(result.error || `HTTP ${response.statusCode}: ${response.body.substring(0, 200)}`);
      }
    } catch (err) {
      console.error(`❌ Google Proxy failed: ${err.message} — falling through to SMTP`);
    }
  }

  // 2. Direct Gmail / SMTP Delivery
  //    Tries port 465 (SSL) then 587 (STARTTLS) automatically.
  //    GoDaddy shared hosting blocks 465 but allows 587 in some plans.
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpUser = process.env.SMTP_USER.trim();
    const cleanPass = process.env.SMTP_PASS.replace(/\s+/g, '');
    const configuredPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : null;

    // Build list of ports to try — if SMTP_PORT is set use only that, else try 465 → 587
    const smtpConfigs = configuredPort
      ? [{ port: configuredPort, secure: configuredPort === 465 }]
      : [{ port: 465, secure: true }, { port: 587, secure: false }];

    let emailSent = false;
    for (const cfg of smtpConfigs) {
      if (emailSent) break;
      try {
        console.log(`📤 SMTP attempt: ${smtpHost}:${cfg.port} (${cfg.secure ? 'SSL/TLS' : 'STARTTLS'}) → ${to}`);
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: cfg.port,
          secure: cfg.secure,
          requireTLS: !cfg.secure,
          auth: { user: smtpUser, pass: cleanPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        });

        const info = await transporter.sendMail({
          from: `"${companyName}" <${smtpUser}>`,
          to,
          subject,
          text: textBody || '',
          html: htmlBody,
        });
        console.log(`✅ Email delivered → ${to} via port ${cfg.port} (ID: ${info.messageId})`);
        emailSent = true;
        return { status: 'sent', method: `smtp-${cfg.port}`, messageId: info.messageId };
      } catch (err) {
        console.error(`❌ SMTP port ${cfg.port} failed for ${to}: [${err.code || err.name}] ${err.message}`);
      }
    }

    if (!emailSent) {
      console.error(`❌ All SMTP attempts exhausted for ${to}. Email NOT delivered.`);
      console.error(`   ↳ Tip: Set GOOGLE_SCRIPT_URL in .env to use Google Apps Script proxy instead.`);
    }
  }

  // 3. Mock Mode (development fallback)
  console.log('\n📧 ═══════ MOCK EMAIL ═══════');
  console.log(`   From:    ${companyName}`);
  console.log(`   To:      ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body:    ${(textBody || '').substring(0, 120)}...`);
  console.log('════════════════════════════\n');
  return { status: 'mock' };
}

// ─── Branded HTML Template ──────────────────────────────────
function buildHtml(title, bodyHtml) {
  const companyName = process.env.COLLEGE_NAME || 'Aharada Education';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFF6FF;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(37,99,235,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1D4ED8 0%,#2563EB 50%,#3B82F6 100%);padding:32px 40px;text-align:left;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${companyName}</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Student Grievance &amp; Task Management Portal</p>
          </td>
        </tr>
        <!-- Title Bar -->
        <tr>
          <td style="background:#DBEAFE;padding:16px 40px;border-bottom:2px solid #BFDBFE;">
            <h2 style="color:#1E40AF;margin:0;font-size:17px;font-weight:600;">${title}</h2>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;color:#1E293B;font-size:15px;line-height:1.75;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F0F9FF;padding:20px 40px;border-top:1px solid #BFDBFE;text-align:center;">
            <p style="color:#64748B;font-size:12px;margin:0;">This is an automated notification from <strong>${companyName}</strong>. Please do not reply to this email.</p>
            <p style="color:#94A3B8;font-size:11px;margin:6px 0 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoBox(label, value) {
  return `<tr><td style="padding:6px 0;color:#475569;font-size:14px;"><strong style="color:#1E3A8A;">${label}:</strong> ${value}</td></tr>`;
}

function statusBadge(status) {
  const colors = {
    'Submitted': '#FBBF24', 'Assigned': '#3B82F6', 'In Progress': '#F97316',
    'Resolved': '#10B981', 'Closed': '#6B7280',
  };
  const bg = colors[status] || '#6B7280';
  return `<span style="background:${bg};color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;">${status}</span>`;
}

// ============================================================
// NOTIFICATION TRIGGERS — Stage-based
// ============================================================

/**
 * Stage 0 — Student submits via Google Form OR Portal
 * → Email to Student: confirmation
 */
async function notifyStudentSubmission({ studentEmail, studentName, grievanceId, title, description }) {
  const sName = formatStudentName(studentName);
  const subject = `✅ [Aharada Education] Grievance Received — Ticket #${grievanceId}`;
  const html = buildHtml(`Grievance Registered — Ticket #${grievanceId}`, `
    <p>Dear <strong>${sName}</strong>,</p>
    <p>Your grievance has been <strong>successfully registered</strong> with Aharada Education. Our administration team will review it and take appropriate action shortly.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F0F9FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Description', `<em>${(description || '').substring(0, 120)}...</em>`)}
      ${infoBox('Current Status', statusBadge('Submitted'))}
    </table>
    <p>You will receive email updates at every stage. Keep this email for reference.</p>
    <p style="margin-top:24px;">Regards,<br><strong>Aharada Education Grievance Office</strong></p>
  `);
  return sendEmail(studentEmail, subject, html, `Your grievance #${grievanceId} has been submitted to Aharada Education. Title: ${title}.`);
}

/**
 * Stage 0 — Notify Dean & all HODs of new submission
 */
async function notifyAdminNewGrievance({ adminUser, studentName, grievanceId, title, description, programName, source, fileUrl }) {
  const adminName = cleanName(adminUser.name);
  const sName = formatStudentName(studentName);
  const subject = `🚨 [Aharada Education] New Grievance Submitted — Ticket #${grievanceId}`;
  const fileLink = fileUrl ? `<a href="${fileUrl}" target="_blank" style="color:#2563EB;font-weight:600;text-decoration:underline;">📎 View Attachment File</a>` : 'None';
  const html = buildHtml(`New Student Grievance — Action Required`, `
    <p>Dear <strong>${adminName}</strong>,</p>
    <p>A new student grievance has been submitted to Aharada Education and requires review.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Student', sName)}
      ${infoBox('Program', programName || 'N/A')}
      ${infoBox('Subject', title)}
      ${infoBox('Description', (description || '').substring(0, 150))}
      ${infoBox('Source', source || 'Portal')}
      ${infoBox('Attachment', fileLink)}
    </table>
    <p>Please login to the portal to review and assign this grievance.</p>
  `);
  return sendEmail(adminUser.email, subject, html);
}

/**
 * Stage 1 — Dean/HOD assigns to Faculty
 * → Email to Faculty: new task
 * → Email to Student: tracking update
 */
async function notifyFacultyAssigned({ facultyUser, grievanceId, title, description, assignedByName, studentName, programName }) {
  const fName = formatFacultyName(facultyUser.name);
  const aName = cleanName(assignedByName);
  const sName = formatStudentName(studentName);
  const subject = `📌 [Aharada Education] New Task Assigned to You — Ticket #${grievanceId}`;
  const html = buildHtml(`Task Delegated — Ticket #${grievanceId}`, `
    <p>Dear <strong>${fName}</strong>,</p>
    <p>A task has been delegated to you by <strong>${aName}</strong> at Aharada Education. Please review and take necessary action.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Student', sName)}
      ${infoBox('Program', programName || 'N/A')}
      ${infoBox('Issue', (description || '').substring(0, 150))}
      ${infoBox('Assigned By', aName)}
      ${infoBox('Status', statusBadge('Assigned'))}
    </table>
    <p>Please log in to your Faculty Portal to review the issue and update progress.</p>
    <p style="margin-top:24px;">Regards,<br><strong>Aharada Education Administration</strong></p>
  `);
  return sendEmail(facultyUser.email, subject, html);
}

async function notifyStudentAssigned({ studentEmail, studentName, facultyName, grievanceId, title }) {
  const sName = formatStudentName(studentName);
  const fName = formatFacultyName(facultyName);
  const subject = `[Aharada Education] Ticket #${grievanceId} Assigned to Faculty`;
  const html = buildHtml(`Your Grievance Has Been Assigned`, `
    <p>Dear <strong>${sName}</strong>,</p>
    <p>Your grievance (Ticket #${grievanceId}) has been reviewed and officially assigned to a faculty member.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Assigned To', `<strong>${fName}</strong>`)}
      ${infoBox('Status', statusBadge('Assigned'))}
    </table>
    <p><strong>💡 Tip:</strong> If you need to follow up, please contact <strong>${fName}</strong> directly.</p>
    <p>You will receive another notification when the status changes.</p>
  `);
  return sendEmail(studentEmail, subject, html);
}

/**
 * Faculty reassigns to another faculty
 */
async function notifyFacultyReassigned({ newFaculty, grievanceId, title, reassignedByName, studentName, reason }) {
  const fName = formatFacultyName(newFaculty.name);
  const rName = cleanName(reassignedByName);
  const sName = formatStudentName(studentName);
  const subject = `🔄 [Aharada Education] Task Reassigned to You — Ticket #${grievanceId}`;
  const html = buildHtml(`Task Reassigned — Ticket #${grievanceId}`, `
    <p>Dear <strong>${fName}</strong>,</p>
    <p>Ticket #${grievanceId} has been reassigned to you by <strong>${rName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Student', sName)}
      ${infoBox('Reassigned By', rName)}
      ${reason ? infoBox('Reason', reason) : ''}
    </table>
    <p>Please log in to the Faculty Portal to review history and take action.</p>
  `);
  return sendEmail(newFaculty.email, subject, html);
}

async function notifyStudentReassigned({ studentEmail, studentName, newFacultyName, grievanceId, title }) {
  const sName = formatStudentName(studentName);
  const fName = formatFacultyName(newFacultyName);
  const subject = `[Aharada Education] Ticket #${grievanceId} — New Faculty Assigned`;
  const html = buildHtml(`Your Ticket Has Been Reassigned`, `
    <p>Dear <strong>${sName}</strong>,</p>
    <p>Your grievance (Ticket #${grievanceId}) has been reassigned to a new faculty member to ensure faster resolution.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Now Handled By', `<strong>${fName}</strong>`)}
    </table>
    <p>For any queries, please reach out to <strong>${fName}</strong>.</p>
  `);
  return sendEmail(studentEmail, subject, html);
}

/**
 * Faculty writes remark for student → Email to student
 */
async function notifyStudentRemark({ studentEmail, studentName, facultyName, grievanceId, title, remark, status, fileUrl }) {
  const sName = formatStudentName(studentName);
  const fName = formatFacultyName(facultyName);
  const subject = `[Aharada Education] Update on Ticket #${grievanceId} — Message from ${fName}`;
  const publicFileUrl = fileUrl ? (fileUrl.startsWith('http') ? fileUrl : `${process.env.BASE_URL || 'http://localhost:5000'}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`) : null;
  
  const html = buildHtml(`Faculty Update on Your Ticket`, `
    <p>Dear <strong>${sName}</strong>,</p>
    <p><strong>${fName}</strong> has posted an update on your grievance.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Current Status', statusBadge(status || 'In Progress'))}
    </table>
    ${remark ? `
      <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;">
        <p style="margin:0;color:#92400E;font-size:14px;font-weight:600;">Message from ${fName}:</p>
        <p style="margin:8px 0 0;color:#1E293B;font-size:15px;">${remark}</p>
      </div>
    ` : ''}
    ${publicFileUrl ? `
      <div style="background:#F0F9FF;border:1px dashed #3B82F6;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
        <p style="margin:0 0 10px 0;color:#1E40AF;font-weight:600;font-size:14px;">📎 Document Attached for You by Faculty:</p>
        <a href="${publicFileUrl}" target="_blank" style="background:#2563EB;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:600;font-size:13px;display:inline-block;">
          📥 Click to Download / View Attachment
        </a>
      </div>
    ` : ''}
  `);
  return sendEmail(studentEmail, subject, html);
}

/**
 * Task Resolved → Notify Student
 */
async function notifyStudentResolved({ studentEmail, studentName, facultyName, grievanceId, title, remark, fileUrl }) {
  const sName = formatStudentName(studentName);
  const fName = formatFacultyName(facultyName);
  const subject = `🎉 [Aharada Education] Ticket #${grievanceId} Has Been Resolved!`;
  const publicFileUrl = fileUrl ? (fileUrl.startsWith('http') ? fileUrl : `${process.env.BASE_URL || 'http://localhost:5000'}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`) : null;

  const html = buildHtml(`Your Grievance Has Been Resolved`, `
    <p>Dear <strong>${sName}</strong>,</p>
    <p>Great news! Your grievance (Ticket #${grievanceId}) has been successfully <strong>RESOLVED</strong> by <strong>${fName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Resolved By', fName)}
      ${infoBox('Status', statusBadge('Resolved'))}
    </table>
    ${remark ? `<div style="background:#F0FDF4;border-left:4px solid #10B981;border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;"><p style="margin:0;color:#065F46;font-weight:600;">Resolution Note:</p><p style="margin:8px 0 0;">${remark}</p></div>` : ''}
    ${publicFileUrl ? `
      <div style="background:#F0FDF4;border:1px dashed #10B981;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
        <p style="margin:0 0 10px 0;color:#065F46;font-weight:600;font-size:14px;">📎 Final Document Attached for You:</p>
        <a href="${publicFileUrl}" target="_blank" style="background:#059669;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:600;font-size:13px;display:inline-block;">
          📥 Click to Download / View Attachment
        </a>
      </div>
    ` : ''}
    <p>Thank you for your patience. If you feel the issue is still unresolved, please contact the administration office.</p>
  `);
  return sendEmail(studentEmail, subject, html);
}

/**
 * Task Resolved → Notify Dean & HOD
 */
async function notifyAdminResolved({ adminUser, facultyName, grievanceId, title, studentName, remark_student, remark_internal }) {
  const adminName = cleanName(adminUser.name);
  const fName = formatFacultyName(facultyName);
  const sName = formatStudentName(studentName);
  const subject = `✅ [Aharada Education] Ticket #${grievanceId} Resolved by ${fName}`;
  const html = buildHtml(`Grievance Resolved — For Your Records`, `
    <p>Dear <strong>${adminName}</strong>,</p>
    <p>Ticket #${grievanceId} (Student: <strong>${sName}</strong>) has been marked as <strong>RESOLVED</strong> by <strong>${fName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Ticket ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Student', sName)}
      ${infoBox('Resolved By', fName)}
      ${infoBox('Status', statusBadge('Resolved'))}
    </table>
    ${remark_student ? `
      <div style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;padding:14px 18px;margin:12px 0;">
        <p style="margin:0;color:#1E40AF;font-size:13px;font-weight:600;">Message Sent to Student:</p>
        <p style="margin:6px 0 0;color:#1E293B;font-size:14px;">${remark_student}</p>
      </div>
    ` : ''}
    ${remark_internal ? `
      <div style="background:#FAF5FF;border-left:4px solid #8B5CF6;border-radius:0 8px 8px 0;padding:14px 18px;margin:12px 0;">
        <p style="margin:0;color:#5B21B6;font-size:13px;font-weight:600;">Internal Staff Remark:</p>
        <p style="margin:6px 0 0;color:#1E293B;font-size:14px;">${remark_internal}</p>
      </div>
    ` : ''}
    <p>You can review full history details in the Admin Dashboard.</p>
  `);
  return sendEmail(adminUser.email, subject, html);
}

/**
 * Faculty updates internal task (created by Dean/HOD) → Notify Dean & HOD
 */
async function notifyAdminInternalUpdate({ adminUser, facultyName, grievanceId, title, status, remark_student, remark_internal, remark }) {
  const adminName = cleanName(adminUser.name);
  const fName = formatFacultyName(facultyName);
  const subject = `📋 [Aharada Education] Internal Task #${grievanceId} Updated by ${fName}`;
  
  const studentRemarkText = remark_student || (remark && !remark_internal ? remark : null);
  const internalRemarkText = remark_internal || (remark && remark !== remark_student ? remark : null);

  const html = buildHtml(`Internal Task Update`, `
    <p>Dear <strong>${adminName}</strong>,</p>
    <p><strong>${fName}</strong> has updated an internal task.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Task ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Updated By', fName)}
      ${status ? infoBox('New Status', statusBadge(status)) : ''}
    </table>
    ${studentRemarkText ? `
      <div style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;padding:14px 18px;margin:12px 0;">
        <p style="margin:0;color:#1E40AF;font-size:13px;font-weight:600;">Student Remark / Response:</p>
        <p style="margin:6px 0 0;color:#1E293B;font-size:14px;">${studentRemarkText}</p>
      </div>
    ` : ''}
    ${internalRemarkText ? `
      <div style="background:#FAF5FF;border-left:4px solid #8B5CF6;border-radius:0 8px 8px 0;padding:14px 18px;margin:12px 0;">
        <p style="margin:0;color:#5B21B6;font-size:13px;font-weight:600;">Internal Staff Remark:</p>
        <p style="margin:6px 0 0;color:#1E293B;font-size:14px;">${internalRemarkText}</p>
      </div>
    ` : ''}
  `);
  return sendEmail(adminUser.email, subject, html);
}

/**
 * Dean creates internal task and assigns to Faculty → Notify Faculty
 */
async function notifyFacultyInternalTask({ facultyUser, grievanceId, title, description, assignedByName }) {
  const fName = formatFacultyName(facultyUser.name);
  const aName = cleanName(assignedByName);
  const subject = `📋 [Aharada Education] Internal Task Assigned — #${grievanceId}`;
  const html = buildHtml(`Internal Task Assigned to You`, `
    <p>Dear <strong>${fName}</strong>,</p>
    <p>An internal administrative task has been assigned to you by <strong>${aName}</strong> at Aharada Education.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Task ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Description', (description || '').substring(0, 200))}
      ${infoBox('Assigned By', aName)}
    </table>
    <p>Please log in to your Faculty Portal to view details and update progress.</p>
    <p>Regards,<br><strong>Aharada Education Administration</strong></p>
  `);
  return sendEmail(facultyUser.email, subject, html);
}

/**
 * Dean creates internal task and assigns to Faculty → Notify HOD
 */
async function notifyHODInternalTaskCreated({ hodUser, facultyName, grievanceId, title, description, assignedByName }) {
  const hName = cleanName(hodUser.name);
  const fName = formatFacultyName(facultyName);
  const aName = cleanName(assignedByName);
  const subject = `📋 [Aharada Education] Internal Task Created & Assigned to ${fName} — Task #${grievanceId}`;
  const html = buildHtml(`Internal Task Created & Assigned`, `
    <p>Dear <strong>${hName}</strong>,</p>
    <p>Dean <strong>${aName}</strong> has created an internal task and assigned it to <strong>${fName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:16px;margin:16px 0;">
      ${infoBox('Task ID', `<strong>#${grievanceId}</strong>`)}
      ${infoBox('Subject', title)}
      ${infoBox('Assigned Faculty', fName)}
      ${infoBox('Created By', aName)}
      ${infoBox('Description', (description || '').substring(0, 200))}
    </table>
    <p>You can monitor this task's progress in your HOD Dashboard.</p>
  `);
  return sendEmail(hodUser.email, subject, html);
}

module.exports = {
  sendEmail,
  cleanName,
  formatFacultyName,
  formatStudentName,
  notifyStudentSubmission,
  notifyAdminNewGrievance,
  notifyFacultyAssigned,
  notifyStudentAssigned,
  notifyFacultyReassigned,
  notifyStudentReassigned,
  notifyStudentRemark,
  notifyStudentResolved,
  notifyAdminResolved,
  notifyAdminInternalUpdate,
  notifyFacultyInternalTask,
  notifyHODInternalTaskCreated,
};
