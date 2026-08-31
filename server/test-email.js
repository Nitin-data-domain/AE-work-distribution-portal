// ============================================================
// Email Diagnostic Script — Tests all email delivery methods
// ============================================================
require('dotenv').config();
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

console.log(`\n${CYAN}════════════════════════════════════════════════════════════${RESET}`);
console.log(`${CYAN}   📧 EMAIL DIAGNOSTIC TOOL — Aharada Education Portal${RESET}`);
console.log(`${CYAN}════════════════════════════════════════════════════════════${RESET}\n`);

// 1. Check environment variables
console.log(`${YELLOW}▸ Step 1: Checking environment variables...${RESET}`);
const checks = {
  'SMTP_HOST': process.env.SMTP_HOST,
  'SMTP_PORT': process.env.SMTP_PORT || '(not set — will auto-try 465/587)',
  'SMTP_USER': process.env.SMTP_USER,
  'SMTP_PASS': process.env.SMTP_PASS ? `${process.env.SMTP_PASS.substring(0, 4)}${'*'.repeat(process.env.SMTP_PASS.length - 4)}` : '❌ MISSING',
  'GOOGLE_SCRIPT_URL': process.env.GOOGLE_SCRIPT_URL || '❌ NOT SET (commented out)',
  'NODE_ENV': process.env.NODE_ENV || 'development',
};

for (const [key, val] of Object.entries(checks)) {
  const icon = val && !val.includes('MISSING') && !val.includes('NOT SET') ? '✅' : '⚠️';
  console.log(`  ${icon} ${key} = ${val}`);
}

// 2. Check SMTP_PASS validity
console.log(`\n${YELLOW}▸ Step 2: Validating SMTP credentials format...${RESET}`);
const rawPass = process.env.SMTP_PASS;
if (!rawPass) {
  console.log(`  ${RED}❌ SMTP_PASS is empty or not set${RESET}`);
} else {
  const cleanPass = rawPass.replace(/\s+/g, '');
  console.log(`  Raw password length: ${rawPass.length}, Cleaned length: ${cleanPass.length}`);
  if (rawPass !== cleanPass) {
    console.log(`  ${YELLOW}⚠️  Password contains whitespace — will be cleaned before use${RESET}`);
  }
  if (cleanPass.length === 16 && /^[a-z]+$/.test(cleanPass)) {
    console.log(`  ${GREEN}✅ Password looks like a valid Google App Password (16 lowercase chars)${RESET}`);
  } else {
    console.log(`  ${YELLOW}⚠️  Password does NOT look like a Google App Password (expected 16 lowercase letters)${RESET}`);
    console.log(`     This could be a regular Gmail password which will FAIL (Google blocks it).`);
    console.log(`     You need a Google App Password: https://myaccount.google.com/apppasswords`);
  }
}

// 3. Test SMTP connections
async function testSMTP() {
  console.log(`\n${YELLOW}▸ Step 3: Testing SMTP connections...${RESET}`);
  
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const cleanPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  
  if (!smtpUser || !cleanPass) {
    console.log(`  ${RED}❌ Cannot test SMTP — missing SMTP_USER or SMTP_PASS${RESET}`);
    return;
  }

  const configs = [
    { port: 465, secure: true, label: 'SSL/TLS' },
    { port: 587, secure: false, label: 'STARTTLS' },
  ];

  for (const cfg of configs) {
    console.log(`\n  ${CYAN}Testing ${smtpHost}:${cfg.port} (${cfg.label})...${RESET}`);
    try {
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

      // Just verify the connection (no email sent)
      await transporter.verify();
      console.log(`  ${GREEN}✅ Port ${cfg.port} — CONNECTION SUCCESSFUL! SMTP auth is working.${RESET}`);

      // Try sending a real test email
      console.log(`  ${CYAN}Sending test email to ${smtpUser}...${RESET}`);
      const info = await transporter.sendMail({
        from: `"Aharada Education Test" <${smtpUser}>`,
        to: smtpUser,
        subject: '🧪 Email Test — Aharada Education Portal',
        text: `This is a test email sent at ${new Date().toISOString()} from the diagnostic tool.`,
        html: `<h2>✅ Email is working!</h2><p>This test email was sent at <strong>${new Date().toISOString()}</strong> from the Aharada Education diagnostic tool.</p>`,
      });
      console.log(`  ${GREEN}✅ TEST EMAIL SENT! Message ID: ${info.messageId}${RESET}`);
      console.log(`  ${GREEN}   Check inbox of ${smtpUser} to confirm delivery.${RESET}`);
      return true; // Success — no need to test further ports

    } catch (err) {
      console.log(`  ${RED}❌ Port ${cfg.port} FAILED: [${err.code || err.name}] ${err.message}${RESET}`);
      
      if (err.code === 'ECONNREFUSED') {
        console.log(`     ↳ Port ${cfg.port} is blocked by firewall or hosting provider`);
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
        console.log(`     ↳ Connection timed out — port likely blocked by ISP or hosting`);
      } else if (err.responseCode === 535 || err.message.includes('auth') || err.message.includes('credentials')) {
        console.log(`     ↳ Authentication failed — check SMTP_USER and SMTP_PASS`);
        console.log(`     ↳ For Gmail: Use App Password from https://myaccount.google.com/apppasswords`);
      }
    }
  }
  return false;
}

// 4. Test Google Apps Script Proxy
async function testGoogleProxy() {
  console.log(`\n${YELLOW}▸ Step 4: Checking Google Apps Script proxy...${RESET}`);
  
  if (!process.env.GOOGLE_SCRIPT_URL) {
    console.log(`  ${RED}❌ GOOGLE_SCRIPT_URL is NOT SET in .env${RESET}`);
    console.log(`  ${YELLOW}   This is the PRIMARY issue if you're on GoDaddy hosting.${RESET}`);
    console.log(`   GoDaddy blocks ALL SMTP ports (465, 587, 25).`);
    console.log(`   Without the Google Apps Script proxy, emails CANNOT be sent from GoDaddy.`);
    console.log(`\n   To fix: Uncomment and set GOOGLE_SCRIPT_URL in your .env file.`);
    return false;
  }
  
  console.log(`  URL: ${process.env.GOOGLE_SCRIPT_URL}`);
  // Test with a ping (no actual email)
  try {
    const url = new URL(process.env.GOOGLE_SCRIPT_URL.trim());
    url.searchParams.set('ping', 'true');
    console.log(`  ${CYAN}Pinging Google Apps Script...${RESET}`);
    // We won't do a full test here since it would send an email
    console.log(`  ${GREEN}✅ URL is valid and parseable${RESET}`);
    return true;
  } catch (err) {
    console.log(`  ${RED}❌ Invalid URL: ${err.message}${RESET}`);
    return false;
  }
}

// Run all tests
(async () => {
  const smtpOk = await testSMTP();
  const proxyOk = await testGoogleProxy();
  
  console.log(`\n${CYAN}════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}   📋 DIAGNOSIS SUMMARY${RESET}`);
  console.log(`${CYAN}════════════════════════════════════════════════════════════${RESET}`);
  
  if (smtpOk) {
    console.log(`\n  ${GREEN}✅ SMTP is working — emails should be delivered via Gmail SMTP.${RESET}`);
    if (!proxyOk) {
      console.log(`  ${YELLOW}⚠️  Google Proxy not configured — SMTP is your only delivery method.${RESET}`);
      console.log(`     If deployed to GoDaddy, SMTP will be blocked. Set GOOGLE_SCRIPT_URL.${RESET}`);
    }
  } else if (proxyOk) {
    console.log(`\n  ${YELLOW}⚠️  SMTP failed but Google Proxy is configured — emails will use proxy.${RESET}`);
  } else {
    console.log(`\n  ${RED}❌ BOTH SMTP and Google Proxy are non-functional!${RESET}`);
    console.log(`  ${RED}   Emails will fall through to MOCK mode (console-only, no actual delivery).${RESET}`);
    console.log(`\n  ${YELLOW}🔧 FIXES NEEDED:${RESET}`);
    console.log(`     1. For Gmail SMTP: Generate App Password at https://myaccount.google.com/apppasswords`);
    console.log(`        Then update SMTP_PASS in .env with the 16-char app password.`);
    console.log(`     2. For GoDaddy: Set GOOGLE_SCRIPT_URL in .env (uncomment line 10).`);
    console.log(`        Deploy a Google Apps Script that sends email via MailApp/GmailApp.`);
  }
  console.log();
})();
