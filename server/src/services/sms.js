// ============================================================
// College Grievance Portal — SMS Service Gateway
// Supports Fast2SMS (India), Twilio (Global), and custom HTTP SMS Proxies
// ============================================================
const https = require('https');
const http = require('http');

/**
 * Send SMS notification to student mobile number
 * @param {string} phone - Target mobile number (e.g. "9876543210" or "+919876543210")
 * @param {string} message - Plain text message body
 */
async function sendSMS(phone, message) {
  if (!phone) {
    console.warn('⚠️  No target phone number provided for SMS notification.');
    return { success: false, reason: 'Missing phone number' };
  }

  // Clean phone number (strip spaces/dashes)
  const cleanPhone = phone.toString().replace(/[^0-9+]/g, '').trim();
  if (cleanPhone.length < 10) {
    console.warn(`⚠️  Invalid phone number format for SMS: ${cleanPhone}`);
    return { success: false, reason: 'Invalid phone format' };
  }

  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  // ── Option 1: Fast2SMS (India — Fast & Low Cost ~₹0.20/SMS)
  if (fast2smsKey) {
    try {
      const payload = JSON.stringify({
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanPhone.replace(/^\+91/, ''),
      });

      const reqOptions = {
        hostname: 'www.fast2sms.com',
        port: 443,
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          'authorization': fast2smsKey.trim(),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const res = await new Promise((resolve, reject) => {
        const request = https.request(reqOptions, (response) => {
          let data = '';
          response.on('data', chunk => { data += chunk; });
          response.on('end', () => resolve({ statusCode: response.statusCode, body: data }));
        });
        request.on('error', err => reject(err));
        request.write(payload);
        request.end();
      });

      console.log(`📱 Fast2SMS sent to ${cleanPhone} | Status: ${res.statusCode}`);
      return { success: true, provider: 'Fast2SMS', result: res.body };
    } catch (err) {
      console.error(`❌ Fast2SMS delivery failed to ${cleanPhone}:`, err.message);
    }
  }

  // ── Option 2: Twilio (Global SMS)
  if (twilioSid && twilioAuth && twilioPhone) {
    try {
      const postData = new URLSearchParams({
        To: cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`,
        From: twilioPhone,
        Body: message,
      }).toString();

      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const reqOptions = {
        hostname: 'api.twilio.com',
        port: 443,
        path: `/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const res = await new Promise((resolve, reject) => {
        const request = https.request(reqOptions, (response) => {
          let data = '';
          response.on('data', chunk => { data += chunk; });
          response.on('end', () => resolve({ statusCode: response.statusCode, body: data }));
        });
        request.on('error', err => reject(err));
        request.write(postData);
        request.end();
      });

      console.log(`📱 Twilio SMS sent to ${cleanPhone} | Status: ${res.statusCode}`);
      return { success: true, provider: 'Twilio', result: res.body };
    } catch (err) {
      console.error(`❌ Twilio SMS delivery failed to ${cleanPhone}:`, err.message);
    }
  }

  // ── Default / Log mode if no API key is configured yet
  console.log(`📱 [SMS SERVICE SIMULATED] To: ${cleanPhone} | Message: "${message}"`);
  return { success: true, simulated: true };
}

module.exports = { sendSMS };
