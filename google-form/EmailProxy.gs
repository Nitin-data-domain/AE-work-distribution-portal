/**
 * ============================================================
 * Aharada Education — Email Proxy via Google Apps Script
 * Uses MailApp (no extra authorization scope required)
 * ============================================================
 */

function decodeBase64Utf8(b64Str) {
  if (!b64Str) return '';
  try {
    var normalized = b64Str.replace(/-/g, '+').replace(/_/g, '/').replace(/ /g, '+');
    while (normalized.length % 4 !== 0) normalized += '=';
    var bytes = Utilities.base64Decode(normalized);
    return Utilities.newBlob(bytes).getDataAsString('UTF-8');
  } catch (e) { return ''; }
}

function sendMailHandler(to, subject, htmlBody, textBody) {
  if (!to || !subject) return { success: false, error: 'Missing recipient (to) or subject' };
  
  var cleanSubject = subject.replace(/^\?+\s*/, '').trim() || subject;
  var finalHtml = htmlBody || textBody || '';
  var finalPlain = textBody || (htmlBody ? htmlBody.replace(/<[^>]+>/g, '') : '');

  MailApp.sendEmail({
    to: to,
    subject: cleanSubject,
    body: finalPlain,
    htmlBody: finalHtml,
    name: 'Aharada Education'
  });
  
  return { success: true, message: 'Email sent to ' + to };
}

function parseParams(data) {
  return {
    to: data.to || data.recipient || '',
    subject: data.b64subject ? decodeBase64Utf8(data.b64subject) : (data.subject || ''),
    htmlBody: data.b64html ? decodeBase64Utf8(data.b64html) : (data.html || data.body || ''),
    textBody: data.b64text ? decodeBase64Utf8(data.b64text) : (data.text || data.message || '')
  };
}

function doGet(e) { return doPost(e); }

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); } catch (err) { data = e.parameter || {}; }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    
    var p = parseParams(data);
    var res = sendMailHandler(p.to, p.subject, p.htmlBody, p.textBody);
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
