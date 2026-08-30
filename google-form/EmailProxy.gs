/**
 * ============================================================
 * Aharada Education — Email Proxy via Google Apps Script
 * Deploy this as a Web App to send emails from GoDaddy
 * ============================================================
 */

function sendMailHandler(to, subject, htmlBody, textBody) {
  if (!to || !subject) {
    return { success: false, error: 'Missing to or subject' };
  }
  
  GmailApp.sendEmail(to, subject, textBody || htmlBody.replace(/<[^>]+>/g, ''), {
    htmlBody: htmlBody || textBody,
    name: 'Aharada Education'
  });
  
  return { success: true, message: 'Email sent to ' + to };
}

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var to = params.to;
    var subject = params.subject;
    var htmlBody = params.html || params.body || '';
    var textBody = params.text || '';
    
    var result = sendMailHandler(to, subject, htmlBody, textBody);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    
    var to = data.to;
    var subject = data.subject;
    var htmlBody = data.html || data.body || '';
    var textBody = data.text || '';
    
    var result = sendMailHandler(to, subject, htmlBody, textBody);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function testEmailProxy() {
  var result = sendMailHandler(
    'nitingirdhar521@gmail.com',
    'Test from Email Proxy',
    '<h2>✅ Email Proxy Working!</h2><p>Emails from GoDaddy will now be delivered via this proxy.</p>',
    'Email Proxy Working!'
  );
  Logger.log(JSON.stringify(result));
}
