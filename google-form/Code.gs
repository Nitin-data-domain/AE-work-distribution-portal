/**
 * ============================================================
 * College Grievance Portal — Google Form Google Apps Script
 * ============================================================
 */

const API_ENDPOINT = "https://17r3d9w7ay.preview.c36.airoapp.ai/api/webhooks/google-form";
const WEBHOOK_SECRET = "COLLEGE_GRIEVANCE_SECRET_2026";

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

    const options = {
      method: "post",
      contentType: "application/json",
      headers: { "Bypass-Tunnel-Reminder": "true" },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(API_ENDPOINT, options);
    Logger.log("Status: " + res.getResponseCode() + " Body: " + res.getContentText());
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

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Bypass-Tunnel-Reminder": "true" },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(API_ENDPOINT, options);
  Logger.log("Test Webhook Code: " + res.getResponseCode());
  Logger.log("Test Webhook Body: " + res.getContentText());
}
