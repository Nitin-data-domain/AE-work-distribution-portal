/**
 * ============================================================
 * Aharada Education — Email Proxy via Google Apps Script
 * Deploy this as a Web App to send emails from GoDaddy
 * ============================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com → Create new project
 * 2. Paste this entire code
 * 3. Click "Deploy" → "New Deployment"
 * 4. Choose "Web app"
 * 5. Set "Execute as" → "Me"
 * 6. Set "Who has access" → "Anyone"
 * 7. Click "Deploy" and copy the Web App URL
 * 8. Add that URL to GoDaddy Secrets as: GOOGLE_SCRIPT_URL
 * ============================================================
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var to = data.to;
    var subject = data.subject;
    var htmlBody = data.html || '';
    var textBody = data.text || '';
    
    if (!to || !subject) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, error: 'Missing to or subject'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    GmailApp.sendEmail(to, subject, textBody, {
      htmlBody: htmlBody,
      name: 'Aharada Education'
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true, message: 'Email sent to ' + to
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Legacy support for GET-based email sending
  try {
    var to = e.parameter.to;
    var subject = e.parameter.subject;
    var body = e.parameter.body || '';
    
    if (!to || !subject) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, error: 'Missing to or subject'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    GmailApp.sendEmail(to, subject, body, {
      name: 'Aharada Education'
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true, message: 'Email sent to ' + to
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function — run this to verify it works
 */
function testEmailProxy() {
  var payload = {
    to: 'nitingirdhar521@gmail.com',
    subject: 'Test from Email Proxy',
    text: 'If you see this, the email proxy is working!',
    html: '<h2>✅ Email Proxy Working!</h2><p>Emails from GoDaddy will now be delivered via this proxy.</p>'
  };
  
  // Simulate a POST request
  GmailApp.sendEmail(payload.to, payload.subject, payload.text, {
    htmlBody: payload.html,
    name: 'Aharada Education'
  });
  
  Logger.log('Test email sent to ' + payload.to);
}
