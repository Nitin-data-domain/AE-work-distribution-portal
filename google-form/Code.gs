/**
 * ============================================================
 * College Grievance Portal — Google Form Google Apps Script
 * ============================================================
 */

const PRIMARY_ENDPOINT = "https://q1hw2q53fo.c36.airoapp.ai/api/webhooks/google-form";
const FALLBACK_ENDPOINT = "https://areaf986x0.c36.airoapp.ai/api/webhooks/google-form";
const WEBHOOK_SECRET = "COLLEGE_GRIEVANCE_SECRET_2026";

function sendToWebhook(data) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Bypass-Tunnel-Reminder": "true" },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  // 1. Try Primary Endpoint (Live Deployment)
  try {
    const res = UrlFetchApp.fetch(PRIMARY_ENDPOINT, options);
    const code = res.getResponseCode();
    const body = res.getContentText();
    Logger.log("Primary Endpoint (" + PRIMARY_ENDPOINT + ") Response: " + code + " | " + body);
    if (code === 200 || code === 201) {
      // Check if body is JSON or "Coming Soon" page
      if (!body.includes("Coming Soon!") && !body.includes("<!DOCTYPE html>")) {
        return { success: true, endpoint: PRIMARY_ENDPOINT, code: code, body: body };
      }
    }
  } catch (err) {
    Logger.log("Primary Endpoint Error: " + err.toString());
  }

  // 2. Fallback Endpoint
  try {
    Logger.log("Trying Fallback Endpoint: " + FALLBACK_ENDPOINT);
    const fallbackRes = UrlFetchApp.fetch(FALLBACK_ENDPOINT, options);
    const fallbackCode = fallbackRes.getResponseCode();
    const fallbackBody = fallbackRes.getContentText();
    Logger.log("Fallback Endpoint Response: " + fallbackCode + " | " + fallbackBody);
    return { success: fallbackCode === 200 || fallbackCode === 201, endpoint: FALLBACK_ENDPOINT, code: fallbackCode, body: fallbackBody };
  } catch (fallbackErr) {
    Logger.log("Fallback Endpoint Error: " + fallbackErr.toString());
    return { success: false, error: fallbackErr.toString() };
  }
}

function onFormSubmit(e) {
  try {
    const itemResponses = e.response.getItemResponses();
    let data = {
      secret_key: WEBHOOK_SECRET,
      student_name: "",
      student_email: e.response.getRespondentEmail() || "",
      admission_no: "",
      phone: "",
      program_name: "",
      title: "",
      problem_desc: "",
      file_url: ""
    };

    for (let i = 0; i < itemResponses.length; i++) {
      const itemTitle = itemResponses[i].getItem().getTitle().toLowerCase().trim();
      const response = itemResponses[i].getResponse();
      const respStr = Array.isArray(response) ? response.join(", ") : String(response || "");

      // 1. Smart Email Capture
      if (itemTitle.includes("email") || itemTitle.includes("mail") || (respStr.includes("@") && !data.student_email)) {
        data.student_email = respStr;
      }
      // 2. Name Capture
      else if (itemTitle.includes("student name") || itemTitle.includes("name")) {
        data.student_name = respStr;
      }
      // 3. Admission / Roll No
      else if (itemTitle.includes("admission") || itemTitle.includes("roll")) {
        data.admission_no = respStr;
      }
      // 4. Phone
      else if (itemTitle.includes("phone") || itemTitle.includes("mobile") || itemTitle.includes("contact")) {
        data.phone = respStr;
      }
      // 5. Program / Course
      else if (itemTitle.includes("program") || itemTitle.includes("course") || itemTitle.includes("branch")) {
        data.program_name = respStr;
      }
      // 6. Title / Subject
      else if (itemTitle.includes("subject") || itemTitle.includes("title")) {
        data.title = respStr;
      }
      // 7. Problem / Grievance Description
      else if (itemTitle.includes("grievance") || itemTitle.includes("problem") || itemTitle.includes("description")) {
        data.problem_desc = respStr;
      }
      // 8. File Upload
      else if (itemTitle.includes("file") || itemTitle.includes("attachment") || itemTitle.includes("upload") || itemTitle.includes("proof")) {
        if (Array.isArray(response) && response.length > 0) {
          try {
            const fileId = response[0];
            const driveFile = DriveApp.getFileById(fileId);
            driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            data.file_url = driveFile.getUrl();
          } catch (err) {
            data.file_url = String(response[0]);
          }
        } else if (typeof response === "string") {
          data.file_url = response;
        }
      }
    }

    if (!data.student_name) data.student_name = "Student";
    if (!data.title) data.title = (data.problem_desc || "Grievance Submission").substring(0, 50);
    if (!data.problem_desc) data.problem_desc = data.title;

    const result = sendToWebhook(data);
    Logger.log("Form Submission Webhook Result: " + JSON.stringify(result));
  } catch (err) {
    Logger.log("Error: " + err.toString());
  }
}

/**
 * 🧪 Direct Test Function
 */
function testWebhook() {
  const data = {
    secret_key: WEBHOOK_SECRET,
    student_name: "Nitin Test Student",
    student_email: "nitingirdhar521@gmail.com",
    admission_no: "ADM-9999",
    phone: "+919876543210",
    program_name: "B Tech Aerospace Engineering",
    title: "Direct Test Grievance from Apps Script",
    problem_desc: "Testing direct webhook execution from Google Apps Script."
  };

  const result = sendToWebhook(data);
  Logger.log("Test Webhook Result: " + JSON.stringify(result));
}
